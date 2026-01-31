"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type CommentVisibility = "VISIBLE" | "HIDDEN" | "AUTHOR_ONLY" | "DELETED";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  isSuperThanks?: boolean;
  superThanksStars?: number;
  superThanksQty?: number;
  senderAnonymous?: boolean;
  isTopSupporter?: boolean;
  isPinned?: boolean;
  isHearted?: boolean;
  user:
    | {
        id: string;
        name: string | null;
        membershipTier: "NONE" | "PREMIUM" | "PREMIUM_PLUS";
        membershipExpiresAt: string | null;
        fanClubTier: "BRONZE" | "SILVER" | "GOLD" | null;
      }
    | null;
  visibility: CommentVisibility;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function djb2Hash(input: string) {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return h >>> 0;
}

function hashUnit(seed: string, salt: string) {
  const h = djb2Hash(`${seed}:${salt}`);
  return (h % 10000) / 10000;
}

function getSuperThanksTier(stars: number) {
  if (stars <= 5) return { tier: "BRONZE" as const, className: "superthanks-tier-bronze", sparkleCount: 1 };
  if (stars <= 10) return { tier: "SILVER" as const, className: "superthanks-tier-silver", sparkleCount: 2 };
  if (stars <= 25) return { tier: "GOLD" as const, className: "superthanks-tier-gold", sparkleCount: 3 };
  if (stars <= 50) return { tier: "PLATINUM" as const, className: "superthanks-tier-platinum", sparkleCount: 4 };
  return { tier: "DIAMOND" as const, className: "superthanks-tier-diamond", sparkleCount: 5 };
}

function StarFillIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M12 2.4l2.9 6.2 6.8.6-5.1 4.4 1.6 6.6L12 16.9 5.8 20.2l1.6-6.6L2.3 9.2l6.8-.6L12 2.4z" />
    </svg>
  );
}

export default function Comments({
  videoId,
  canModerate = false,
  disabled = false,
}: {
  videoId: string;
  canModerate?: boolean;
  disabled?: boolean;
}) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewerFanClubTier, setViewerFanClubTier] = useState<"BRONZE" | "SILVER" | "GOLD" | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  const visibleComments = useMemo(() => {
    // The API already filters for non-moderators.
    return comments.filter((c) => c.visibility !== "DELETED");
  }, [comments]);

  function isMembershipActive(u: Comment["user"]) {
    if (!u || u.membershipTier === "NONE") return false;
    if (!u.membershipExpiresAt) return false;
    return new Date(u.membershipExpiresAt).getTime() > Date.now();
  }

  function tierBadge(u: Comment["user"]) {
    if (!isMembershipActive(u)) return null;
    if (u!.membershipTier === "PREMIUM_PLUS") return <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Premium+</span>;
    if (u!.membershipTier === "PREMIUM") return <span className="ml-2 rounded bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-300">Premium</span>;
    return null;
  }

function fanClubBadge(tier: "BRONZE" | "SILVER" | "GOLD" | null | undefined) {
  if (!tier) return null;
  const label = tier === "BRONZE" ? "Bronze" : tier === "SILVER" ? "Silver" : "Gold";
  const cls =
    tier === "BRONZE"
      ? "ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
      : tier === "SILVER"
        ? "ml-2 rounded bg-slate-500/15 px-2 py-0.5 text-[11px] font-semibold text-slate-200"
        : "ml-2 rounded bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-200";
  return <span className={cls}>⭐ {label} Member</span>;
}


  async function load() {
    setLoading(true);
    const res = await fetch(`/api/comments?videoId=${encodeURIComponent(videoId)}`, { cache: "no-store" });
    const data = await res.json();
    setComments(data.comments || []);
    setViewerFanClubTier(data.viewerFanClubTier ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [videoId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    if (!content.trim()) return;

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, content }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Không thể gửi bình luận.");
      return;
    }

    setContent("");
    await load();
  }

  async function moderate(commentId: string, action: "HIDE" | "UNHIDE" | "DELETE" | "PIN" | "UNPIN" | "HEART" | "UNHEART") {
    const res = await fetch("/api/comments/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, action }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Không thể thao tác.");
      return;
    }

    await load();
  }

  async function reportComment(commentId: string, reason?: string) {
    const res = await fetch("/api/comments/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, reason }),
    });
    if (!res.ok) {
      alert("Báo cáo thất bại.");
      return;
    }
    alert("Đã gửi báo cáo. Cảm ơn bạn!");
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Bình luận</h3>

      {disabled ? (
        <div className="card small muted">Bình luận đã bị tắt cho video này.</div>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          {viewerFanClubTier ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs text-muted-foreground">Perks:</div>
              <div className="flex flex-wrap gap-1">
                {(() => {
                  const base = ["👍", "😂", "🔥", "❤️", "👏", "✨"];
                  const silver = ["💎", "🚀", "😎", "🤯"];
                  const gold = ["👑", "🏆", "🌟", "💯", "🥇", "🤑"];
                  const tier = viewerFanClubTier;
                  const list = tier === "GOLD" ? base.concat(silver, gold) : tier === "SILVER" ? base.concat(silver) : base;
                  return list.map((emo) => (
                    <button
                      key={emo}
                      type="button"
                      className="rounded border px-2 py-1 text-sm hover:bg-muted"
                      onClick={() => setContent((prev) => `${prev}${prev ? " " : ""}${emo}`)}
                      title={`Fan Club ${tier}`}
                    >
                      {emo}
                    </button>
                  ));
                })()}
              </div>
            </div>
          ) : null}

          <textarea
            className="w-full rounded border p-2"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={session ? "Viết bình luận..." : "Bình luận (khách)"}
          />
          <button className="btn" type="submit">
            Gửi bình luận
          </button>
        </form>
      )}

      {loading ? (
        <div className="small muted">Đang tải...</div>
      ) : visibleComments.length === 0 ? (
        <div className="small muted">Chưa có bình luận nào.</div>
      ) : (
        <div className="space-y-3">
          {visibleComments.map((c) => {
            const active = isMembershipActive(c.user);
            const isPlus = active && c.user?.membershipTier === "PREMIUM_PLUS";
            const isST = Boolean(c.isSuperThanks);
            const stars = Number(c.superThanksStars ?? 0);
            const st = isST ? getSuperThanksTier(stars) : null;
            return (
              <div
                key={c.id}
                className={
                  isST
                    ? `superthanks-card superthanks-pt ${st?.className ?? ""}`
                    : `rounded border p-3 ${active ? "border-zinc-700 bg-zinc-950/30" : ""} ${isPlus ? "ring-1 ring-amber-500/40" : ""}`
                }
              >
                {isST ? <div className="superthanks-pt-accent" aria-hidden="true" /> : null}

                {isST ? (
                  <div className="superthanks-sparkles" aria-hidden="true">
                    {Array.from({ length: st?.sparkleCount ?? 1 }).map((_, i) => {
                      const left = 8 + hashUnit(c.id, `l:${i}`) * 84;
                      const top = 18 + hashUnit(c.id, `t:${i}`) * 62;
                      const delay = hashUnit(c.id, `d:${i}`) * 1.6;
                      const size = 12 + hashUnit(c.id, `s:${i}`) * 10;
                      const dur = 1400 + hashUnit(c.id, `dur:${i}`) * 1400;
                      return (
                        <span
                          key={i}
                          className="superthanks-sparkle"
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            animationDelay: `${delay}s`,
                            fontSize: `${size}px`,
                            animationDuration: `${dur}ms`,
                          }}
                        >
                          ★
                        </span>
                      );
                    })}
                  </div>
                ) : null}

              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <div className="small font-semibold">
                    {c.senderAnonymous ? "Ẩn danh" : (c.user?.name || "Guest") }
                    {c.senderAnonymous ? null : tierBadge(c.user)}{c.senderAnonymous ? null : fanClubBadge((c.user as any)?.fanClubTier)}
                    {c.isPinned ? <span className="ml-2 rounded bg-zinc-900/70 px-2 py-0.5 text-[11px] font-semibold text-zinc-100">📌 Pinned</span> : null}
                    {c.isHearted ? <span className="ml-2 rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-200">❤ Heart</span> : null}
                    {c.visibility === "HIDDEN" ? <span className="muted"> • (đã ẩn)</span> : null}
                  </div>
                  <div className="small muted">{new Date(c.createdAt).toLocaleString()}</div>
                </div>

                {isST ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="superthanks-pill superthanks-pill-gold superthanks-pulse" title={`Super Thanks ${stars} stars`}>
                      <span className="superthanks-spin" aria-hidden="true">
                        <StarFillIcon className="h-4 w-4 superthanks-star-fill" />
                      </span>
                      <span className="font-extrabold">Super Thanks</span>
                      <span className="superthanks-pill-sep" aria-hidden="true">•</span>
                      <span className="font-bold">{stars} stars</span>
                    </span>
                    {c.isTopSupporter ? <span className="superthanks-top-supporter">TOP SUPPORTER</span> : null}
                  </div>
                ) : null}

                {session?.user ? (
                  <button className="btn" type="button" onClick={() => reportComment(c.id)}>
                    Báo cáo
                  </button>
                ) : null}

                {canModerate ? (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {c.isPinned ? (
                      <button className="btn" type="button" onClick={() => moderate(c.id, "UNPIN")}>
                        Bỏ ghim
                      </button>
                    ) : (
                      <button className="btn" type="button" onClick={() => moderate(c.id, "PIN")}>
                        Ghim
                      </button>
                    )}
                    {c.isHearted ? (
                      <button className="btn" type="button" onClick={() => moderate(c.id, "UNHEART")}>
                        Bỏ tim
                      </button>
                    ) : (
                      <button className="btn" type="button" onClick={() => moderate(c.id, "HEART")}>
                        Tim
                      </button>
                    )}

                    {c.visibility === "HIDDEN" ? (
                      <button className="btn" type="button" onClick={() => moderate(c.id, "UNHIDE")}> 
                        Bỏ ẩn
                      </button>
                    ) : (
                      <button className="btn" type="button" onClick={() => moderate(c.id, "HIDE")}>
                        Ẩn
                      </button>
                    )}
                    <button className="btn" type="button" onClick={() => moderate(c.id, "DELETE")}>
                      Xóa
                    </button>
                  </div>
                ) : null}
              </div>
              <p className={`mt-2 whitespace-pre-wrap ${isST ? "superthanks-content" : ""}`}>{c.content}</p>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
