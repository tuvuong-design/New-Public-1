import { prisma } from "../../prisma";
import { applyReferralBonusTx } from "../../lib/referrals";

function monthKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Scan creator memberships near expiry and attempt to renew by charging Stars.
 *
 * Design goals:
 * - idempotent (CreatorMembershipInvoice unique(membershipId, monthKey))
 * - safe retries (BullMQ job retries won't double charge)
 * - no heavy work in web request
 */
export async function membershipBillingScanJob(opts: { renewAheadHours: number }) {
  const now = new Date();
  const horizon = new Date(now.getTime() + opts.renewAheadHours * 60 * 60 * 1000);

  const due = await prisma.creatorMembership.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      source: "PAID" as any,
      expiresAt: { lte: horizon },
    },
    select: {
      id: true,
      userId: true,
      creatorId: true,
      planId: true,
      expiresAt: true,
      plan: { select: { starsPrice: true, durationDays: true } },
    },
    take: 500,
  });

  let renewed = 0;
  let lapsed = 0;
  let skipped = 0;

  for (const m of due) {
    const nextPeriodStart = m.expiresAt;
    const mk = monthKey(nextPeriodStart);

    try {
      await prisma.$transaction(async (tx) => {
        const invoice = await tx.creatorMembershipInvoice.findUnique({ where: { membershipId_monthKey: { membershipId: m.id, monthKey: mk } } });
        if (invoice) {
          skipped++;
          return;
        }

        const user = await tx.user.findUnique({ where: { id: m.userId }, select: { starBalance: true } });
        if (!user) {
          await tx.creatorMembership.update({ where: { id: m.id }, data: { status: "LAPSED" } });
          lapsed++;
          return;
        }

        const price = Number(m.plan.starsPrice ?? 0);
        const days = Number(m.plan.durationDays ?? 30);

        if (!Number.isFinite(price) || price <= 0) {
          // Misconfigured plan - mark lapsed to avoid infinite loop.
          await tx.creatorMembership.update({ where: { id: m.id }, data: { status: "LAPSED" } });
          lapsed++;
          return;
        }

        if ((user.starBalance ?? 0) < price) {
          await tx.creatorMembership.update({ where: { id: m.id }, data: { status: "LAPSED" } });
          lapsed++;
          return;
        }

        await tx.user.update({ where: { id: m.userId }, data: { starBalance: { decrement: price } } });

        const st = await tx.starTransaction.create({
          data: {
            userId: m.userId,
            delta: -price,
            stars: price,
            type: "CREATOR_MEMBERSHIP_PURCHASE",
            note: `creator_membership_renew\ncreatorId=${m.creatorId}\nplanId=${m.planId}\nmonthKey=${mk}\nmembershipId=${m.id}`,
          },
        });
        // Credit creator income on renew (worker: month scan).
        await tx.user.update({ where: { id: m.creatorId }, data: { starBalance: { increment: price } } }).catch(() => null);
        const incomeTx = await tx.starTransaction.create({
          data: {
            userId: m.creatorId,
            delta: price,
            stars: price,
            type: "CREATOR_MEMBERSHIP_PURCHASE",
            note: `creator_membership_renew_income
fromUserId=${m.userId}
planId=${m.planId}
monthKey=${mk}
membershipId=${m.id}`,
          },
          select: { id: true },
        });

        await applyReferralBonusTx(tx as any, {
          referredUserId: m.creatorId,
          baseStars: price,
          sourceKind: "EARN",
          sourceId: incomeTx.id,
          baseStarTxId: incomeTx.id,
        }).catch(() => null);


        await tx.creatorMembershipInvoice.create({
          data: { membershipId: m.id, monthKey: mk, stars: price, starTxId: st.id },
        });

        const extensionMs = days * 24 * 60 * 60 * 1000;
        await tx.creatorMembership.update({
          where: { id: m.id },
          data: { expiresAt: new Date(m.expiresAt.getTime() + extensionMs), status: "ACTIVE" },
        });

        renewed++;
      });
    } catch {
      // ignore per-membership errors; scan will retry next cycle.
    }
  }

  return { ok: true as const, renewed, lapsed, skipped, scanned: due.length };
}
