import fs from "node:fs";
import path from "node:path";

export type DocsNavItem = {
  /** URL part, ex: "quickstart" or "r2-optimization" */
  slug: string;
  title: string;
  /** File name under /docs */
  file: string;
};

export type DocsNavSection = {
  title: string;
  items: DocsNavItem[];
};

export type DocsNav = {
  sections: DocsNavSection[];
};

const DOCS_ROOT = path.join(process.cwd(), "docs");
const NAV_PATH = path.join(DOCS_ROOT, "docs.nav.json");

function readJsonFile<T>(p: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getDocsNav(): DocsNav {
  const nav = readJsonFile<DocsNav>(NAV_PATH, { sections: [] });
  // Basic validation (avoid runtime crashes when nav file is edited).
  if (!nav || !Array.isArray((nav as any).sections)) return { sections: [] };
  return nav;
}

export function findDocItemBySlug(slug: string): DocsNavItem | null {
  const nav = getDocsNav();
  for (const sec of nav.sections) {
    for (const it of sec.items) {
      if (it.slug === slug) return it;
    }
  }
  return null;
}

export function readDocFile(file: string) {
  // Only allow files inside /docs to avoid path traversal.
  const safeName = path.basename(file);
  const full = path.join(DOCS_ROOT, safeName);
  if (!full.startsWith(DOCS_ROOT)) throw new Error("Invalid doc path");
  return fs.readFileSync(full, "utf8");
}

export function getDocBySlugParts(slugParts: string[] | undefined):
  | {
      slug: string;
      title: string;
      file: string;
      content: string;
    }
  | null {
  const slug = (slugParts ?? []).join("/") || "readme";
  const item = findDocItemBySlug(slug);
  if (!item) return null;

  const content = readDocFile(item.file);
  return { slug, title: item.title, file: item.file, content };
}
