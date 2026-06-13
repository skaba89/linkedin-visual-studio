import { NextResponse } from "next/server";
import { linkedInCompliance } from "@/lib/compliance";

export async function GET() {
  const status = await linkedInCompliance.getStatus();
  const warmupInfo = await linkedInCompliance.getWarmupInfo();

  return NextResponse.json({
    status,
    warmupInfo,
  });
}
