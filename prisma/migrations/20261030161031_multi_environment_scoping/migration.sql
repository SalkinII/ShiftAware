-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('PLANNING', 'OPEN_FOR_PREFERENCES', 'ASSIGNING', 'FINALIZED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EnvironmentRole" AS ENUM ('MEMBER', 'ADMIN');

-- AlterEnum
BEGIN;
CREATE TYPE "EntityType_new" AS ENUM ('TEAM_MEMBER', 'SHIFT', 'ASSIGNMENT', 'PREFERENCE', 'CONFIG', 'ENVIRONMENT', 'FESTIVAL');
ALTER TABLE "AuditLog" ALTER COLUMN "entityType" TYPE "EntityType_new" USING ("entityType"::text::"EntityType_new");
ALTER TYPE "EntityType" RENAME TO "EntityType_old";
ALTER TYPE "EntityType_new" RENAME TO "EntityType";
DROP TYPE "EntityType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "EventRegistration" DROP CONSTRAINT "EventRegistration_memberId_fkey";

-- DropForeignKey
ALTER TABLE "EventRegistration" DROP CONSTRAINT "EventRegistration_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventTemplate" DROP CONSTRAINT "EventTemplate_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventTemplate" DROP CONSTRAINT "EventTemplate_templateId_fkey";

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventConfig" DROP CONSTRAINT "EventConfig_eventId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftTemplate" DROP CONSTRAINT "ShiftTemplate_eventId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduledShift" DROP CONSTRAINT "ScheduledShift_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventAttributeDefinition" DROP CONSTRAINT "EventAttributeDefinition_eventId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMemberAttribute" DROP CONSTRAINT "TeamMemberAttribute_definitionId_fkey";

-- DropForeignKey
ALTER TABLE "PlanMarker" DROP CONSTRAINT "PlanMarker_eventId_fkey";

-- DropIndex
DROP INDEX "Shift_eventId_startTime_idx";

-- DropIndex
DROP INDEX "ShiftTemplate_eventId_idx";

-- DropIndex
DROP INDEX "ScheduledShift_eventId_date_idx";

-- DropIndex
DROP INDEX "PlanMarker_eventId_startTime_idx";

-- AlterTable
ALTER TABLE "Shift" DROP COLUMN "eventId",
ADD COLUMN     "environmentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ShiftTemplate" DROP COLUMN "eventId",
ADD COLUMN     "festivalId" TEXT;

-- AlterTable
ALTER TABLE "ScheduledShift" DROP COLUMN "eventId",
ADD COLUMN     "environmentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PlanMarker" DROP COLUMN "eventId",
ADD COLUMN     "environmentId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "EventRegistration";

-- DropTable
DROP TABLE "EventTemplate";

-- DropTable
DROP TABLE "EventConfig";

-- DropTable
DROP TABLE "EventAttributeDefinition";

-- DropEnum
DROP TYPE "EventStatus";

-- CreateTable
CREATE TABLE "Festival" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Festival_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "EnvironmentStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentRegistration" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "role" "EnvironmentRole" NOT NULL DEFAULT 'MEMBER',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentTemplate" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentConfig" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "minShiftsPerPerson" INTEGER NOT NULL DEFAULT 2,
    "algorithmWeights" JSONB NOT NULL,
    "balanceThresholds" JSONB NOT NULL,
    "autoAssignUnfilled" BOOLEAN NOT NULL DEFAULT true,
    "allocationRules" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeDefinition" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "options" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentAttributeRequirement" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentAttributeRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Environment_festivalId_idx" ON "Environment"("festivalId");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_festivalId_name_key" ON "Environment"("festivalId", "name");

-- CreateIndex
CREATE INDEX "EnvironmentRegistration_environmentId_idx" ON "EnvironmentRegistration"("environmentId");

-- CreateIndex
CREATE INDEX "EnvironmentRegistration_memberId_idx" ON "EnvironmentRegistration"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentRegistration_memberId_environmentId_key" ON "EnvironmentRegistration"("memberId", "environmentId");

-- CreateIndex
CREATE INDEX "EnvironmentTemplate_environmentId_idx" ON "EnvironmentTemplate"("environmentId");

-- CreateIndex
CREATE INDEX "EnvironmentTemplate_templateId_idx" ON "EnvironmentTemplate"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentTemplate_environmentId_templateId_key" ON "EnvironmentTemplate"("environmentId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentConfig_environmentId_key" ON "EnvironmentConfig"("environmentId");

-- CreateIndex
CREATE INDEX "AttributeDefinition_festivalId_idx" ON "AttributeDefinition"("festivalId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_festivalId_name_key" ON "AttributeDefinition"("festivalId", "name");

-- CreateIndex
CREATE INDEX "EnvironmentAttributeRequirement_environmentId_idx" ON "EnvironmentAttributeRequirement"("environmentId");

-- CreateIndex
CREATE INDEX "EnvironmentAttributeRequirement_definitionId_idx" ON "EnvironmentAttributeRequirement"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentAttributeRequirement_environmentId_definitionId_key" ON "EnvironmentAttributeRequirement"("environmentId", "definitionId");

-- CreateIndex
CREATE INDEX "Shift_environmentId_startTime_idx" ON "Shift"("environmentId", "startTime");

-- CreateIndex
CREATE INDEX "ShiftTemplate_festivalId_idx" ON "ShiftTemplate"("festivalId");

-- CreateIndex
CREATE INDEX "ScheduledShift_environmentId_date_idx" ON "ScheduledShift"("environmentId", "date");

-- CreateIndex
CREATE INDEX "PlanMarker_environmentId_startTime_idx" ON "PlanMarker"("environmentId", "startTime");

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentRegistration" ADD CONSTRAINT "EnvironmentRegistration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentRegistration" ADD CONSTRAINT "EnvironmentRegistration_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentTemplate" ADD CONSTRAINT "EnvironmentTemplate_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentTemplate" ADD CONSTRAINT "EnvironmentTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentConfig" ADD CONSTRAINT "EnvironmentConfig_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeDefinition" ADD CONSTRAINT "AttributeDefinition_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentAttributeRequirement" ADD CONSTRAINT "EnvironmentAttributeRequirement_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentAttributeRequirement" ADD CONSTRAINT "EnvironmentAttributeRequirement_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberAttribute" ADD CONSTRAINT "TeamMemberAttribute_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMarker" ADD CONSTRAINT "PlanMarker_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

