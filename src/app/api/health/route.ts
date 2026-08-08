import { NextResponse } from "next/server";
import { getHealth } from "@/core/observability/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealth();
  const status = health.db === "up" ? 200 : 503;
  return NextResponse.json(health, { status });
}
