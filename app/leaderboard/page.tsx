import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { nextLevelXp } from "@/lib/gamification/levels";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;

  const [top, me] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ xp: "desc" }, { level: "desc" }, { createdAt: "asc" }],
      take: 50,
      select: { id: true, name: true, xp: true, level: true },
    }),
    viewerId ? prisma.user.findUnique({ where: { id: viewerId }, select: { id: true, name: true, xp: true, level: true } }) : null,
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">Leaderboard</div>
        <div className="small muted mt-1">Task 12: Gamification MVP — XP/Level leaderboard.</div>
      </div>

      {me ? (
        <div className="card">
          <div className="font-semibold">You</div>
          <div className="small muted">
            Level <b>{me.level}</b> • XP <b>{me.xp}</b> • Next level at <b>{nextLevelXp(me.level)}</b>
          </div>
        </div>
      ) : null}

      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-[56px_1fr_120px_80px] gap-2 border-b bg-zinc-50 px-4 py-2 text-xs font-semibold">
          <div>#</div>
          <div>User</div>
          <div>XP</div>
          <div>Level</div>
        </div>
        {top.map((u, idx) => (
          <a
            key={u.id}
            href={`/u/${u.id}`}
            className="grid grid-cols-[56px_1fr_120px_80px] gap-2 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            <div className="text-muted-foreground">{idx + 1}</div>
            <div className="font-medium line-clamp-1">{u.name ?? "Anonymous"}</div>
            <div>{u.xp}</div>
            <div>{u.level}</div>
          </a>
        ))}
      </div>
    </main>
  );
}
