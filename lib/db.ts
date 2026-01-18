import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Verify Prisma client has required models (development only)
if (process.env.NODE_ENV === "development") {
  const requiredModels = [
    "shiftTemplate",
    "shiftTemplateRole",
    "scheduledShift",
  ];
  const missing = requiredModels.filter((model) => !(model in prisma));

  if (missing.length > 0) {
    console.warn(
      `⚠️  Prisma client missing models: ${missing.join(", ")}. ` +
        `Run 'npm run db:migrate-safe' or 'npx prisma generate' (stop dev server first)`,
    );
  }
}