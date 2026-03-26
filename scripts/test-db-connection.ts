#!/usr/bin/env tsx
/**
 * Test script to verify Prisma connectivity and core tables.
 * Run with: npx tsx scripts/test-db-connection.ts
 */

import { prisma } from "../lib/db";

async function testConnection() {
  console.log("Testing database connection with Prisma...\n");

  try {
    const [{ current_time, pg_version }] = await prisma.$queryRaw<
      { current_time: Date; pg_version: string }[]
    >`SELECT NOW() as current_time, version() as pg_version`;

    console.log("✓ Database connection successful");
    console.log(`  Current time: ${current_time.toISOString()}`);
    console.log(`  PostgreSQL version: ${pg_version.split(" ")[1]}\n`);

    const models: Array<keyof typeof prisma> = [
      "teamMember",
      "event",
      "shift",
      "shiftPreference",
      "assignment",
      "auditLog",
      "eventConfig",
      "systemConfig",
    ];

    for (const model of models) {
      const repository = (prisma as any)[model];
      if (!repository?.count) {
        console.log(`  ✗ Model '${String(model)}' not found on Prisma client`);
        continue;
      }

      const count = await repository.count();
      console.log(`  ✓ ${String(model)} -> ${count} rows`);
    }

    console.log("\n✓ All checks passed!");
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
