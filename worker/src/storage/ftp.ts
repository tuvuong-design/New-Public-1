import { Client } from "basic-ftp";
import fs from "node:fs";
import path from "node:path";

export async function withFtp<T>(args: { host: string; port: number; username: string; password: string }, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(20_000);
  try {
    await client.access({ host: args.host, port: args.port, user: args.username, password: args.password });
    return await fn(client);
  } finally {
    client.close();
  }
}

export async function ftpEnsureDir(client: Client, dir: string) {
  const d = String(dir || "").trim();
  if (!d) return;
  await client.ensureDir(d);
}

export async function ftpUploadDir(client: Client, localDir: string, remoteDir: string) {
  const files: string[] = [];
  const walk = (p: string) => {
    for (const name of fs.readdirSync(p)) {
      const full = path.join(p, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(localDir);

  for (const f of files) {
    const rel = path.relative(localDir, f).replaceAll(path.sep, "/");
    const remotePath = `${remoteDir.replace(/\/+$/, "")}/${rel}`;
    const parent = remotePath.split("/").slice(0, -1).join("/");
    if (parent) await client.ensureDir(parent);
    await client.uploadFrom(f, remotePath);
  }
}

export async function ftpExists(client: Client, remotePath: string): Promise<boolean> {
  try {
    // list parent and check name
    const rp = remotePath.replace(/\/+$/, "");
    const parts = rp.split("/");
    const name = parts.pop() || "";
    const dir = parts.join("/") || ".";
    const list = await client.list(dir);
    return list.some((x) => x.name === name);
  } catch {
    return false;
  }
}
