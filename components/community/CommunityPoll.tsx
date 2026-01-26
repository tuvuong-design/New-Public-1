"use client";

import { useState } from "react";

type Option = {
  id: string;
  text: string;
  votes: number;
};

export default function CommunityPoll({
  postId,
  options,
  viewerVotedOptionId,
}: {
  postId: string;
  options: Option[];
  viewerVotedOptionId: string | null;
}) {
  const [voteId, setVoteId] = useState(viewerVotedOptionId);
  const [busy, setBusy] = useState(false);

  async function vote(optionId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/community/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, optionId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Vote failed");
      setVoteId(optionId);
      // Simple refresh to update counts
      window.location.reload();
    } catch (e: any) {
      alert(e?.message || "Vote failed");
    } finally {
      setBusy(false);
    }
  }

  const total = options.reduce((a, b) => a + b.votes, 0);

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        const isChosen = voteId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            className={`w-full rounded-md border px-3 py-2 text-left ${isChosen ? "bg-zinc-100" : "bg-white"}`}
            onClick={() => vote(opt.id)}
            disabled={busy || !!voteId}
            title={voteId ? "Bạn đã bình chọn" : "Bình chọn"}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="small font-semibold">{opt.text}</div>
              <div className="small muted">{opt.votes} • {pct}%</div>
            </div>
            <div className="mt-1 h-2 w-full rounded bg-zinc-200">
              <div className="h-2 rounded bg-zinc-900" style={{ width: `${pct}%` }} />
            </div>
          </button>
        );
      })}
      <div className="small muted">Tổng: {total} votes</div>
    </div>
  );
}
