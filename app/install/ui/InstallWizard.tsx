"use client";

import { useMemo, useState } from "react";

type TestResult = { ok: boolean; message: string };

function genSecret() {
  // 32 bytes -> base64url
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return b64;
}

function line(key: string, value: string) {
  // quote values with spaces or special chars
  const needsQuote = /\s|#|\$|`|"|'/g.test(value);
  const v = needsQuote ? JSON.stringify(value) : value;
  return `${key}=${v}`;
}

export default function InstallWizard() {
  const [step, setStep] = useState(1);

  // Step 1: basics
  const [siteUrl, setSiteUrl] = useState("http://localhost:3000");
  const [nextAuthUrl, setNextAuthUrl] = useState("http://localhost:3000");
  const [authSecret, setAuthSecret] = useState(genSecret());

  // Step 2: DB
  const [dbUrl, setDbUrl] = useState("mysql://user:pass@127.0.0.1:3306/videoshare");
  const [dbTest, setDbTest] = useState<TestResult | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  // Step 3: Redis
  const [redisUrl, setRedisUrl] = useState("redis://127.0.0.1:6379");
  const [redisTest, setRedisTest] = useState<TestResult | null>(null);
  const [redisLoading, setRedisLoading] = useState(false);

  // Step 4: R2
  const [r2AccountId, setR2AccountId] = useState("");
  const [r2AccessKeyId, setR2AccessKeyId] = useState("");
  const [r2Secret, setR2Secret] = useState("");
  const [r2Bucket, setR2Bucket] = useState("");
  const [r2PublicBase, setR2PublicBase] = useState("");
  const [r2Test, setR2Test] = useState<TestResult | null>(null);
  const [r2Loading, setR2Loading] = useState(false);

  // Step 5: write env
  const [writeResult, setWriteResult] = useState<TestResult | null>(null);
  const [writing, setWriting] = useState(false);

  const envContent = useMemo(() => {
    const lines = [
      line("SITE_URL", siteUrl),
      line("NEXTAUTH_URL", nextAuthUrl),
      line("AUTH_SECRET", authSecret),
      line("DATABASE_URL", dbUrl),
      line("REDIS_URL", redisUrl),
      "",
      "# Upload tuning",
      line("UPLOAD_MAX_BYTES", String(2147483648)),
      line("UPLOAD_PART_BYTES", String(209715200)),
      "",
      "# Cloudflare R2",
      line("R2_ACCOUNT_ID", r2AccountId),
      line("R2_ACCESS_KEY_ID", r2AccessKeyId),
      line("R2_SECRET_ACCESS_KEY", r2Secret),
      line("R2_BUCKET", r2Bucket),
      line("R2_PUBLIC_BASE_URL", r2PublicBase),
      "",
      "# Optional",
      line("NEXT_PUBLIC_ENABLE_PWA", "true"),
      line("INDEXNOW_ENABLED", "false"),
      line("GA_ENABLED", "false"),
      line("ONESIGNAL_ENABLED", "false"),
      "",
      "# Install Wizard",
      line("INSTALL_WIZARD_ENABLED", "false"),
    ];
    return lines.join("\n");
  }, [siteUrl, nextAuthUrl, authSecret, dbUrl, redisUrl, r2AccountId, r2AccessKeyId, r2Secret, r2Bucket, r2PublicBase]);

  async function postJson<T>(url: string, body: any): Promise<T> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }
    return data as T;
  }

  async function testDb() {
    setDbLoading(true);
    setDbTest(null);
    try {
      const data = await postJson<{ ok: true; message: string }>("/api/install/test-db", { databaseUrl: dbUrl });
      setDbTest({ ok: true, message: data.message || "OK" });
    } catch (e: any) {
      setDbTest({ ok: false, message: e?.message || "DB test failed" });
    } finally {
      setDbLoading(false);
    }
  }

  async function testRedis() {
    setRedisLoading(true);
    setRedisTest(null);
    try {
      const data = await postJson<{ ok: true; message: string }>("/api/install/test-redis", { redisUrl });
      setRedisTest({ ok: true, message: data.message || "OK" });
    } catch (e: any) {
      setRedisTest({ ok: false, message: e?.message || "Redis test failed" });
    } finally {
      setRedisLoading(false);
    }
  }

  async function testR2() {
    setR2Loading(true);
    setR2Test(null);
    try {
      const data = await postJson<{ ok: true; message: string }>("/api/install/test-r2", {
        r2AccountId,
        r2AccessKeyId,
        r2Secret,
        r2Bucket,
        r2PublicBase,
      });
      setR2Test({ ok: true, message: data.message || "OK" });
    } catch (e: any) {
      setR2Test({ ok: false, message: e?.message || "R2 test failed" });
    } finally {
      setR2Loading(false);
    }
  }

  async function tryWriteEnv() {
    setWriting(true);
    setWriteResult(null);
    try {
      const data = await postJson<{ ok: true; message: string }>("/api/install/write-env", { envContent, overwrite: false });
      setWriteResult({ ok: true, message: data.message || "Wrote .env" });
    } catch (e: any) {
      setWriteResult({ ok: false, message: e?.message || "Write failed" });
    } finally {
      setWriting(false);
    }
  }

  function canNextBasics() {
    return siteUrl.startsWith("http") && nextAuthUrl.startsWith("http") && authSecret.length >= 10;
  }
  function canNextDb() {
    return Boolean(dbTest?.ok);
  }
  function canNextRedis() {
    return Boolean(redisTest?.ok);
  }
  function canNextR2() {
    return Boolean(r2Test?.ok);
  }

  return (
    <div className="card" style={{ padding: 14, display: "grid", gap: 14 }}>
      <Stepper step={step} setStep={setStep} />

      {step === 1 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Step 1 — Cơ bản</h2>
          <label>
            SITE_URL
            <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://your-domain.com" />
          </label>
          <label>
            NEXTAUTH_URL
            <input value={nextAuthUrl} onChange={(e) => setNextAuthUrl(e.target.value)} placeholder="https://your-domain.com" />
          </label>
          <label>
            AUTH_SECRET
            <div className="row" style={{ gap: 8 }}>
              <input value={authSecret} onChange={(e) => setAuthSecret(e.target.value)} />
              <button type="button" onClick={() => setAuthSecret(genSecret())}>Generate</button>
            </div>
            <div className="small muted">Secret dùng cho NextAuth/JWT. Không chia sẻ secret này.</div>
          </label>

          <div className="row" style={{ justifyContent: "space-between" }}>
            <div />
            <button type="button" disabled={!canNextBasics()} onClick={() => setStep(2)}>Next</button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Step 2 — Database (MySQL)</h2>
          <label>
            DATABASE_URL
            <input value={dbUrl} onChange={(e) => setDbUrl(e.target.value)} />
            <div className="small muted">Ví dụ: <code>mysql://user:pass@127.0.0.1:3306/videoshare</code></div>
          </label>

          <div className="row" style={{ gap: 8 }}>
            <button type="button" onClick={testDb} disabled={dbLoading}>{dbLoading ? "Testing..." : "Test connection"}</button>
            {dbTest ? <Badge ok={dbTest.ok} text={dbTest.message} /> : null}
          </div>

          <div className="row" style={{ justifyContent: "space-between" }}>
            <button type="button" onClick={() => setStep(1)}>Back</button>
            <button type="button" disabled={!canNextDb()} onClick={() => setStep(3)}>Next</button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Step 3 — Redis</h2>
          <label>
            REDIS_URL
            <input value={redisUrl} onChange={(e) => setRedisUrl(e.target.value)} />
            <div className="small muted">Ví dụ: <code>redis://127.0.0.1:6379</code> hoặc <code>redis://:password@host:6379</code></div>
          </label>

          <div className="row" style={{ gap: 8 }}>
            <button type="button" onClick={testRedis} disabled={redisLoading}>{redisLoading ? "Testing..." : "Test connection"}</button>
            {redisTest ? <Badge ok={redisTest.ok} text={redisTest.message} /> : null}
          </div>

          <div className="row" style={{ justifyContent: "space-between" }}>
            <button type="button" onClick={() => setStep(2)}>Back</button>
            <button type="button" disabled={!canNextRedis()} onClick={() => setStep(4)}>Next</button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Step 4 — Cloudflare R2</h2>
          <label>R2_ACCOUNT_ID <input value={r2AccountId} onChange={(e) => setR2AccountId(e.target.value)} /></label>
          <label>R2_ACCESS_KEY_ID <input value={r2AccessKeyId} onChange={(e) => setR2AccessKeyId(e.target.value)} /></label>
          <label>R2_SECRET_ACCESS_KEY <input value={r2Secret} onChange={(e) => setR2Secret(e.target.value)} /></label>
          <label>R2_BUCKET <input value={r2Bucket} onChange={(e) => setR2Bucket(e.target.value)} /></label>
          <label>
            R2_PUBLIC_BASE_URL
            <input value={r2PublicBase} onChange={(e) => setR2PublicBase(e.target.value)} placeholder="https://pub-xxxx.r2.dev" />
            <div className="small muted">URL public để serve HLS/thumbnail/storyboard.</div>
          </label>

          <div className="row" style={{ gap: 8 }}>
            <button type="button" onClick={testR2} disabled={r2Loading}>{r2Loading ? "Testing..." : "Test connection"}</button>
            {r2Test ? <Badge ok={r2Test.ok} text={r2Test.message} /> : null}
          </div>

          <div className="row" style={{ justifyContent: "space-between" }}>
            <button type="button" onClick={() => setStep(3)}>Back</button>
            <button type="button" disabled={!canNextR2()} onClick={() => setStep(5)}>Next</button>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Step 5 — Finish</h2>
          <div className="small muted">
            Bản an toàn: copy-paste nội dung dưới đây vào <b>aaPanel → Website → Config → Environment (.env)</b> rồi restart app.
          </div>

          <textarea readOnly rows={16} value={envContent} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }} />

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => navigator.clipboard.writeText(envContent)}>Copy .env</button>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([envContent], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = ".env";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download .env
            </button>

            <button type="button" onClick={tryWriteEnv} disabled={writing}>
              {writing ? "Writing..." : "Try write .env on server"}
            </button>

            {writeResult ? <Badge ok={writeResult.ok} text={writeResult.message} /> : null}
          </div>

          <div className="card" style={{ background: "#fafafa" }}>
            <b>After install</b>
            <ul>
              <li>Restart web app / node process.</li>
              <li>Chạy <code>npm run prisma:push</code> và <code>npm run prisma:seed</code> (nếu chưa chạy).</li>
              <li>Wizard sẽ tự ẩn khi env đầy đủ. Nếu muốn mở lại: set <code>INSTALL_WIZARD_ENABLED=true</code>.</li>
              <li>Có thể xoá: <code>app/install</code>, <code>app/api/install</code>, <code>lib/install</code>, <code>middleware.ts</code> sau khi ổn định.</li>
            </ul>
          </div>

          <div className="row" style={{ justifyContent: "space-between" }}>
            <button type="button" onClick={() => setStep(4)}>Back</button>
            <div className="row" style={{ gap: 8 }}>
              <a className="small" href="/api/health" target="_blank" rel="noreferrer">Test /api/health</a>
              <button type="button" onClick={() => setStep(6)}>Next: Verify</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  const steps = ["Cơ bản", "DB", "Redis", "R2", "Finish", "Verify"];
  return (
    <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        return (
          <button
            key={label}
            type="button"
            onClick={() => setStep(n)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #e5e5e5",
              background: active ? "#111" : "#fff",
              color: active ? "#fff" : "#111",
            }}
          >
            {n}. {label}
          </button>
        );
      })}

{step === 6 ? (
  <div style={{ display: "grid", gap: 10 }}>
    <h2 style={{ margin: 0 }}>Step 6 — Verify production</h2>
    <div className="small muted">
      Sau khi bạn đã paste <code>.env</code> vào aaPanel và restart app, hãy chạy verify để kiểm tra <b>DB / Redis / R2</b> bằng env hiện tại.
    </div>

    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <a className="small" href="/verify" target="_blank" rel="noreferrer">Mở /verify</a>
      <a className="small" href="/api/verify" target="_blank" rel="noreferrer">Xem JSON /api/verify</a>
            <a className="small" href="/api/verify/worker" target="_blank" rel="noreferrer">Ping worker /api/verify/worker</a>
      <a className="small" href="/api/health" target="_blank" rel="noreferrer">/api/health</a>
    </div>

    <div className="card" style={{ background: "#fafafa" }}>
      <b>Checklist</b>
      <ul>
        <li>Web app đã restart với env mới.</li>
        <li>Chạy <code>npm run prisma:push</code> + <code>npm run prisma:seed</code> (nếu chưa).</li>
        <li>Worker chạy process riêng và có <code>ffmpeg</code> + <code>ffprobe</code>.</li>
      </ul>
    </div>

    <div className="row" style={{ justifyContent: "space-between" }}>
      <button type="button" onClick={() => setStep(5)}>Back</button>
      <a className="small" href="/feed">Go to site</a>
    </div>
  </div>
) : null}
    </div>
  );
}

function Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className="small"
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid #e5e5e5",
        background: ok ? "rgba(0,200,0,0.08)" : "rgba(200,0,0,0.08)",
      }}
    >
      {ok ? "✅" : "❌"} {text}
    </span>
  );
}
