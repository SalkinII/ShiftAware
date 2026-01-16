#!/usr/bin/env tsx
/**
 * Verify Prisma client includes new models
 * Run: npx tsx scripts/verify-prisma-client.ts
 */

import { PrismaClient } from "@prisma/client";

async function verify() {
  console.log("Verifying Prisma client models...\n");

  const prisma = new PrismaClient();

  try {
    // Check if new models exist
    const models = ["shiftTemplate", "shiftTemplateRole", "scheduledShift"];

    const missing: string[] = [];

    for (const model of models) {
      if (!(model in prisma)) {
        missing.push(model);
      }
    }

    if (missing.length > 0) {
      console.error("❌ Missing models in Prisma client:");
      missing.forEach((m) => console.error(`   - ${m}`));
      console.error("\nFix: Run 'npx prisma generate' (stop dev server first)");
      process.exit(1);
    }

    console.log("✅ All models present in Prisma client:");
    models.forEach((m) => console.log(`   ✓ ${m}`));

    // Try a simple query to verify it works
    try {
      await prisma.shiftTemplate.findMany({ take: 0 });
      console.log("\n✅ Prisma client is functional");
    } catch (error) {
      console.error("\n❌ Prisma client query failed:");
      console.error(error);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

verify();
