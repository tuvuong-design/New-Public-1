"use client";

import { useState } from "react";

type PostType = "TEXT" | "IMAGE" | "GIF" | "POLL" | "YOUTUBE" | "LINK";

export default function CommunityPostComposer() {
  const [type, setType] = useState<PostType>("TEXT");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const payload: any = { type, text };
      if (mediaUrl) payload.mediaUrl = mediaUrl;
      if (linkUrl) payload.linkUrl = linkUrl;
      if (youtubeUrl) payload.youtubeUrl = youtubeUrl;
      if (type === "POLL") {
        payload.pollQuestion = pollQuestion;
        payload.pollOptions = pollOptions.filter((o) => o.trim().length > 0);
      }

      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Post failed");
      }
      window.location.reload();
    } catch (e: any) {
      alert(e?.message || "Post failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="font-extrabold">Tạo bài viết</div>

      <label className="small block">
        <div className="muted mb-1">Loại bài</div>
        <select
          className="w-full rounded-md border px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as PostType)}
        >
          <option value="TEXT">Text</option>
          <option value="LINK">Link</option>
          <option value="YOUTUBE">YouTube</option>
          <option value="IMAGE">Image URL</option>
          <option value="GIF">GIF URL</option>
          <option value="POLL">Poll</option>
        </select>
      </label>

      <label className="small block">
        <div className="muted mb-1">Nội dung</div>
        <textarea
          className="w-full rounded-md border px-3 py-2"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bạn đang nghĩ gì?"
        />
      </label>

      {(type === "IMAGE" || type === "GIF") ? (
        <label className="small block">
          <div className="muted mb-1">Media URL</div>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>
      ) : null}

      {type === "LINK" ? (
        <label className="small block">
          <div className="muted mb-1">Link URL</div>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>
      ) : null}

      {type === "YOUTUBE" ? (
        <label className="small block">
          <div className="muted mb-1">YouTube URL</div>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </label>
      ) : null}

      {type === "POLL" ? (
        <div className="space-y-2">
          <label className="small block">
            <div className="muted mb-1">Câu hỏi</div>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Bạn chọn phương án nào?"
            />
          </label>

          <div className="space-y-2">
            <div className="small muted">Các lựa chọn</div>
            {pollOptions.map((opt, idx) => (
              <input
                key={idx}
                className="w-full rounded-md border px-3 py-2"
                value={opt}
                onChange={(e) => {
                  const next = [...pollOptions];
                  next[idx] = e.target.value;
                  setPollOptions(next);
                }}
                placeholder={`Option ${idx + 1}`}
              />
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => setPollOptions([...pollOptions, ""])}
              >
                Thêm option
              </button>
              {pollOptions.length > 2 ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPollOptions(pollOptions.slice(0, -1))}
                >
                  Xóa option
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button className="btn" disabled={submitting} onClick={submit} type="button">
          {submitting ? "Đang đăng..." : "Đăng"}
        </button>
      </div>
    </div>
  );
}
