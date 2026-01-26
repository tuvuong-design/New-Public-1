import type { Session } from "next-auth";

export function isAdmin(session: Session | null | undefined) {
  // @ts-expect-error custom field
  return Boolean(session?.user && session.user.role === "ADMIN");
}

export function requireAdmin(session: Session | null | undefined) {
  if (!isAdmin(session)) throw new Error("FORBIDDEN");
}
