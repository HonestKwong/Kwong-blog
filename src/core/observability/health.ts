import { prisma } from "@/core/db/client";

export interface HealthStatus {
  status: "ok" | "degraded";
  time: string;
  db: "up" | "down";
}

export async function getHealth(): Promise<HealthStatus> {
  const time = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
    return { status: "ok", time, db: "up" };
  } catch {
    return { status: "degraded", time, db: "down" };
  }
}
