"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Suggestion = { name: string; slug: string; score: number };

export default function SeoPanel({ videoId, baseTags }: { videoId: string; baseTags: string }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copyText, setCopyText] = useState(baseTags);

  useEffect(() => {
    setCopyText(baseTags);
  }, [baseTags]);

  const suggestedText = useMemo(() => {
    if (suggestions.length === 0) return "";
    const s = suggestions.map((x) => x.slug).join(", ");
    if (!copyText.trim()) return s;
    return `${copyText}, ${s}`;
  }, [suggestions, copyText]);

  async function loadSuggestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/videos/${videoId}/tags/suggest`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (e: any) {
      setError(e?.message || "ERROR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags Suggestion</CardTitle>
        <CardDescription>
          Gợi ý tags dựa trên title/description (heuristic nhẹ, không gọi API ngoài). Bạn có thể copy rồi paste vào Admin
          Video Metadata.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={loadSuggestions} disabled={loading}>
            {loading ? "Suggesting..." : "Suggest tags"}
          </Button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>

        {suggestions.length ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Badge key={s.slug} variant="secondary" title={`score ${s.score}`}>
                {s.slug}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Chưa có gợi ý.</div>
        )}

        <div className="space-y-1">
          <div className="text-xs text-zinc-500">Copy/paste tags (comma separated)</div>
          <pre className="whitespace-pre-wrap rounded-xl border bg-zinc-50 p-3 text-sm">{suggestedText || copyText}</pre>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigator.clipboard.writeText((suggestedText || copyText).trim())}
            disabled={!(suggestedText || copyText).trim()}
          >
            Copy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
