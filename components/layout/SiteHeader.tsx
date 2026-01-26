import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSiteConfig } from "@/lib/siteConfig";
import UserMenu from "./UserMenu";

export default async function SiteHeader() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;

  const site = await getSiteConfig();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
      <div className="container flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold tracking-tight hover:no-underline"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
              ▶
            </span>
            <span>{site.siteName ?? "VideoShare"}</span>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <Link className="btn btn-ghost px-3 py-2" href="/">
              Home
            </Link>
            <Link className="btn btn-ghost px-3 py-2" href="/feed">
              Feed
            </Link>
            <Link className="btn btn-ghost px-3 py-2" href="/subscriptions">
              Subscriptions
            </Link>
            {session?.user ? (
              <>
                <Link className="btn btn-ghost px-3 py-2" href="/history">
                  History
                </Link>
                <Link className="btn btn-ghost px-3 py-2" href="/playlists">
                  Playlists
                </Link>
              </>
            ) : null}
            <Link className="btn btn-ghost px-3 py-2" href="/trending">
              Trending
            </Link>
            <Link className="btn btn-ghost px-3 py-2" href="/boost">
              Boost
            </Link>
            <Link className="btn btn-ghost px-3 py-2" href="/nft">
              NFT
            </Link>
            <Link className="btn btn-ghost px-3 py-2" href="/premium">
              Premium
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link className="btn btn-primary" href="/upload">
            Upload
          </Link>

          {session?.user ? (
            <Link className="btn" href="/studio">
              Studio
            </Link>
          ) : null}

          {role === "ADMIN" ? (
            <Link className="btn" href="/admin">
              Admin
            </Link>
          ) : null}

          {session?.user ? (
            <UserMenu name={session.user.name ?? session.user.email ?? "User"} userId={userId} />
          ) : (
            <Link className="btn" href="/login">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
