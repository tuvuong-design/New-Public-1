"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export default function UserMenu({
  name,
  userId,
}: {
  name: string;
  userId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
        {name}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg">
          {userId ? (
            <Link
              className="btn btn-ghost w-full justify-start"
              href={`/u/${userId}`}
              onClick={() => setOpen(false)}
            >
              Profile
            </Link>
          ) : null}

          <Link
            className="btn btn-ghost w-full justify-start"
            href="/my-channel"
            onClick={() => setOpen(false)}
          >
            Kênh của tôi
          </Link>

          <Link
            className="btn btn-ghost w-full justify-start"
            href="/notifications"
            onClick={() => setOpen(false)}
          >
            Notifications
          </Link>

          <Link
            className="btn btn-ghost w-full justify-start"
            href="/settings/notifications"
            onClick={() => setOpen(false)}
          >
            Notification settings
          </Link>

          <button
            type="button"
            className="btn btn-ghost w-full justify-start"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
