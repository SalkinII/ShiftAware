-- AlterTable
ALTER TABLE "EventConfig" ADD COLUMN "allocationRules" JSONB NOT NULL DEFAULT '[]'::jsonb;
