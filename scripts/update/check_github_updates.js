#!/usr/bin/env node
/**
 * Check GitHub for new commits/releases and notify Telegram.
 *
 * Env:
 * - GITHUB_REPO=owner/repo
 * - GITHUB_BRANCH=main (optional)
 * - GITHUB_TOKEN=... (optional; required for private repos or higher rate limits)
 * - TELEGRAM_NOTIFY_ENABLED=true
 * - TELEGRAM_BOT_TOKEN=...
 * - TELEGRAM_CHAT_ID=...
 *
 * Storage:
 * - .cache/last_seen_commit
 */
import fs from "node:fs";
import path from "node:path";

const repo = process.env.GITHUB_REPO || "";
const branch = process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || "";

const tgEnabled = (process.env.TELEGRAM_NOTIFY_ENABLED || "false").toLowerCase() === "true";
const tgToken = process.env.TELEGRAM_BOT_TOKEN || "";
const tgChat = process.env.TELEGRAM_CHAT_ID || "";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function sendTelegram(text) {
  if (!tgEnabled) return;
  if (!tgToken || !tgChat) return;
  const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: tgChat, text, disable_web_page_preview: true }),
  }).catch(() => {});
}

async function gh(url) {
  const headers = { "accept": "application/vnd.github+json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json();
}

if (!repo.includes("/")) fail("Missing GITHUB_REPO=owner/repo");

const cacheDir = path.join(process.cwd(), ".cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
const stateFile = path.join(cacheDir, "last_seen_commit");

const apiBase = `https://api.github.com/repos/${repo}`;
const commit = await gh(`${apiBase}/commits/${encodeURIComponent(branch)}`);
if (!commit) fail("Cannot fetch GitHub commit (check repo/branch/token)");

const sha = (commit.sha || "").toString();
const msg = (commit.commit?.message || "").split("\n")[0];
const htmlUrl = commit.html_url || "";

const prev = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, "utf-8").trim() : "";

if (prev && prev === sha) {
  console.log("No updates.");
  process.exit(0);
}

fs.writeFileSync(stateFile, sha, "utf-8");

const text = `✅ Có bản cập nhật mới\nRepo: ${repo}@${branch}\nCommit: ${sha.slice(0, 7)}\nMsg: ${msg}\nLink: ${htmlUrl}\n\nGợi ý: git pull && npm install && npm run build && restart web/worker`;
console.log(text);
await sendTelegram(text);
