import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var workerPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.workerPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.workerPrisma = prisma;
