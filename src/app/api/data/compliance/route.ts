import { NextResponse } from "next/server";
import { linkedInCompliance } from "@/lib/compliance";

export async function GET() {
  const status = linkedInCompliance.getStatus();
  const warmupInfo = linkedInCompliance.getWarmupInfo();

  return NextResponse.json({
    status,
    warmupInfo,
  });
}
