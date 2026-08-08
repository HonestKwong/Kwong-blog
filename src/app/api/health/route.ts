import { NextResponse } from "next/server";
import { getHealth } from "@/core/observability/health";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getHealth());
}
