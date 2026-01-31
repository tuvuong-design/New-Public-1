import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const enc = new TextEncoder();
const key = enc.encode(env.AUTH_SECRET);

export type JwtUser = {
  sub: string;
  email: string | null;
  role: string;
};

export async function signAccessToken(payload: JwtUser, expiresIn = "15m") {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function signRefreshToken(payload: JwtUser, expiresIn = "30d") {
  return await new SignJWT({ ...payload, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, key);
  return payload as any;
}
