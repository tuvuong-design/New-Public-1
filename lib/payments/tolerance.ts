import { Prisma } from "@prisma/client";

export function withinTolerance(expected: Prisma.Decimal, actual: Prisma.Decimal, toleranceBps: number) {
  if (toleranceBps <= 0) return expected.equals(actual);
  const tol = expected.mul(toleranceBps).div(10000);
  const min = expected.sub(tol);
  const max = expected.add(tol);
  return actual.greaterThanOrEqualTo(min) && actual.lessThanOrEqualTo(max);
}
