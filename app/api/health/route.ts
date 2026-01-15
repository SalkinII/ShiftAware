import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const missing: string[] = [];
  const checks: Record<string, boolean> = {};

  // Check required environment variables
  if (!process.env.ADMIN_PASSWORD?.trim()) {
    missing.push("ADMIN_PASSWORD");
  }
  checks.env = missing.length === 0;

  // Check database connectivity
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch (error) {
    console.error("Database health check failed:", error);
  }
  checks.database = dbConnected;

  const allHealthy = checks.env && checks.database;

  if (process.env.NODE_ENV === "production" && !allHealthy) {
    return NextResponse.json(
      {
        status: "error",
        checks,
        missingEnv: missing,
        message: "Health checks failed",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: allHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    checks,
    missingEnv: missing,
  });
}
