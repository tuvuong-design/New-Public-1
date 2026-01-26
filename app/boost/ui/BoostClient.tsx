"use client";

import { resolveMediaUrl } from "@/lib/mediaUrl";
import SmartImage from "@/components/media/SmartImage";

type BoostPlanDTO = {
  id: string;
  name: string;
  type: string;
  priceStars: number;
  durationDays: number | null;
};

type VideoDTO = {
  id: string;
  title: string;
  thumbKey: string | null;
  viewCount: number;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  starCount: number;
  giftCount: number;
  createdAt: string;
};

type BoostOrderDTO = {
  id: string;
  status: string;
  videoId: string;
  videoTitle: string;
  planName: string;
  priceStars: number;
  startAt: string;
  endAt: string | null;
  statViews: number;
  statLikes: number;
  statShares: number;
  statComments: number;
  statStars: number;
  statGifts: number;
};

export default function BoostClient(props: {
  starBalance: number;
  plans: BoostPlanDTO[];
  videos: VideoDTO[];
  orders: BoostOrderDTO[];
}) {
  const { starBalance, plans, videos, orders } = props;

  return (
    <main style={{ display: "grid", gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 800 }}>Boost video</div>
        <div className="small muted">
          Số ⭐ hiện có: <b>{starBalance}</b>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 800 }}>Plans</div>
        <div className="small muted" style={{ marginTop: 6 }}>
          Chọn plan rồi boost cho video của bạn.
        </div>
        <ul style={{ marginTop: 10 }}>
          {plans.map((p) => (
            <li key={p.id}>
              <b>{p.name}</b> • type {p.type} • price ⭐ {p.priceStars}{" "}
              {p.type === "DURATION" ? <span className="small muted">• {p.durationDays} days</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div style={{ fontWeight: 800 }}>Your videos</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
            marginTop: 10,
          }}
        >
          {videos.map((v) => (
            <div key={v.id} className="card" style={{ border: "1px solid #eee" }}>
              <a href={`/v/${v.id}`}>
                <div style={{ aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", background: "#f3f3f3" }}>
                  {v.thumbKey ? (
                    <SmartImage
                      src={resolveMediaUrl(v.thumbKey) ?? ""}
                      alt={v.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 360px"
                    />
                  ) : (
                    <div className="muted small" style={{ padding: 10 }}>
                      No thumbnail
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 10, fontWeight: 800 }}>{v.title}</div>
                <div className="small muted">
                  {v.viewCount} views • {v.likeCount} likes • {v.commentCount} cmt • {v.shareCount} shares • ⭐ {v.starCount} • 🎁 {v.giftCount}
                </div>
              </a>

              <form
                action="#"
                style={{ marginTop: 10, display: "grid", gap: 8 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  const planId = String(fd.get("planId"));
                  const res = await fetch("/api/boost/start", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ videoId: v.id, planId }),
                  }).then((r) => r.json());

                  if (!res?.ok) alert(res?.message ?? "Boost failed");
                  else {
                    alert("Boost started!");
                    location.reload();
                  }
                }}
              >
                <select name="planId" required>
                  <option value="">Chọn plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (⭐ {p.priceStars})
                    </option>
                  ))}
                </select>
                <button type="submit">Boost this video</button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 800 }}>Boost orders (report)</div>
        <div className="small muted">Báo cáo tương tác trong thời gian boost = stat* (incremental).</div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
          <thead>
            <tr>
              <th align="left">Video</th>
              <th>Status</th>
              <th align="right">Plan</th>
              <th align="right">⭐ Price</th>
              <th align="right">Δ views</th>
              <th align="right">Δ likes</th>
              <th align="right">Δ shares</th>
              <th align="right">Δ cmt</th>
              <th align="right">Δ ⭐</th>
              <th align="right">Δ 🎁</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
                <td>
                  <a href={`/v/${o.videoId}`}>
                    <b>{o.videoTitle}</b>
                  </a>
                  <div className="small muted">
                    {new Date(o.startAt).toLocaleDateString()} → {o.endAt ? new Date(o.endAt).toLocaleDateString() : "-"}
                  </div>
                </td>
                <td align="center">
                  <b>{o.status}</b>
                </td>
                <td align="right">{o.planName}</td>
                <td align="right">⭐ {o.priceStars}</td>
                <td align="right">{o.statViews}</td>
                <td align="right">{o.statLikes}</td>
                <td align="right">{o.statShares}</td>
                <td align="right">{o.statComments}</td>
                <td align="right">{o.statStars}</td>
                <td align="right">{o.statGifts}</td>
                <td align="right">
                  {o.status === "ACTIVE" ? (
                    <button
                      onClick={async () => {
                        await fetch("/api/boost/cancel", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ id: o.id }),
                        });
                        location.reload();
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
