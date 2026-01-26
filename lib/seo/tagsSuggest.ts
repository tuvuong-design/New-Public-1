const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "if",
  "in",
  "into",
  "is",
  "it",
  "no",
  "not",
  "of",
  "on",
  "or",
  "such",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "will",
  "with",
  // Vietnamese light stopwords
  "và",
  "là",
  "của",
  "cho",
  "một",
  "những",
  "các",
  "để",
  "trong",
  "khi",
  "đã",
  "đang",
  "với",
  "từ",
]);

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function tokenize(text: string) {
  const cleaned = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ");

  return cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && t.length <= 32)
    .filter((t) => !STOPWORDS.has(t));
}

export function suggestTagsFromText({ title, description }: { title: string; description: string }, limit = 12) {
  const tokens = [...tokenize(title), ...tokenize(description)];
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + (title.toLowerCase().includes(t) ? 3 : 1));

  // Lightweight 2-gram extraction for title
  const titleTokens = tokenize(title);
  for (let i = 0; i < titleTokens.length - 1; i++) {
    const phrase = `${titleTokens[i]} ${titleTokens[i + 1]}`;
    if (phrase.length <= 40) counts.set(phrase, (counts.get(phrase) ?? 0) + 4);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(limit, 6));

  // Return both display name and slug.
  return ranked.map(([name, score]) => ({ name, slug: slugify(name), score }));
}
