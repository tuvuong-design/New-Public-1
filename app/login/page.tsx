"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Đăng nhập</CardTitle>
          <CardDescription>
            Dùng Credentials. Nếu chưa có admin, chạy <code>npm run prisma:seed</code>.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErr("");
              const res = await signIn("credentials", {
                email,
                password,
                callbackUrl: "/admin",
                redirect: false,
              });
              if ((res as any)?.error) setErr("Sai email hoặc password");
              else window.location.href = "/admin";
            }}
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {err ? <div className="text-sm font-medium text-red-600">{err}</div> : null}

            <Button type="submit">Sign in</Button>

            <div className="small muted">
              <Link href="/" className="underline">
                ← Quay lại Home
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
