import * as React from "react";
import { apiFetch } from "./lib/api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import "./index.css";

export default function App() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [me, setMe] = React.useState<any>(null);

  async function login() {
    await apiFetch("/api/auth-jwt/login", { method: "POST", body: JSON.stringify({ email, password }) });
    const res = await apiFetch("/api/auth-jwt/me");
    setMe(res.user);
  }

  async function loadVideos() {
    const res = await apiFetch("/api/public/videos");
    alert(`Loaded ${res?.items?.length ?? 0} videos`);
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">VideoShare Vite UI</h1>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <div className="text-sm opacity-80">JWT Cookie Auth (Next backend)</div>
          <div className="flex gap-2">
            <Input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={login} variant="luxury">Login</Button>
            <Button onClick={loadVideos} variant="outline">Test /api/public/videos</Button>
          </div>
          {me && <pre className="text-xs opacity-90">{JSON.stringify(me, null, 2)}</pre>}
        </div>
      </div>
    </div>
  );
}
