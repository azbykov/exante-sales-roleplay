import { NextResponse } from "next/server";
import { listScenarios } from "@/lib/content/registry";

/** The public catalogue: hidden needs and resolution conditions never reach it. */
export function GET() {
  return NextResponse.json(listScenarios());
}
