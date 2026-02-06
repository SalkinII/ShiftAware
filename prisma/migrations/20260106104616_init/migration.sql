-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('JUNIOR', 'INTERMEDIATE', 'SENIOR');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEAM_MEMBER', 'SHIFT_LEAD', 'SUPER');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MOBILE_TEAM', 'STATIONARY', 'SUPER');

-- CreateEnum
CREATE TYPE "ShiftPriority" AS ENUM ('BUFFER', 'CORE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNING', 'OPEN_FOR_PREFERENCES', 'ASSIGNING', 'FINALIZED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('ALGORITHM', 'MANUAL', 'RANDOM', 'SWAP');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PREFERENCE_SUBMIT', 'ASSIGNMENT_RUN', 'MANUAL_SWAP', 'EXPORT');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('TEAM_MEMBER', 'SHIFT', 'ASSIGNMENT', 'PREFERENCE', 'CONFIG');

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "avatarId" TEXT NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "genderRole" TEXT NOT NULL,
    "capabilities" "Role"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "ShiftType" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "priority" "ShiftPriority" NOT NULL DEFAULT 'CORE',
    "desirabilityScore" INTEGER NOT NULL DEFAULT 3,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftRole" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ShiftRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftPreference" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "assignmentType" "AssignmentType" NOT NULL DEFAULT 'ALGORITHM',
    "algorithmScore" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventConfig" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "minShiftsPerPerson" INTEGER NOT NULL DEFAULT 2,
    "algorithmWeights" JSONB NOT NULL,
    "balanceThresholds" JSONB NOT NULL,
    "autoAssignUnfilled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_alias_key" ON "TeamMember"("alias");

-- CreateIndex
CREATE INDEX "TeamMember_alias_idx" ON "TeamMember"("alias");

-- CreateIndex
CREATE INDEX "Shift_eventId_startTime_idx" ON "Shift"("eventId", "startTime");

-- CreateIndex
CREATE INDEX "Shift_type_priority_idx" ON "Shift"("type", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftRole_shiftId_role_key" ON "ShiftRole"("shiftId", "role");

-- CreateIndex
CREATE INDEX "ShiftPreference_shiftId_idx" ON "ShiftPreference"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftPreference_teamMemberId_shiftId_key" ON "ShiftPreference"("teamMemberId", "shiftId");

-- CreateIndex
CREATE INDEX "Assignment_teamMemberId_idx" ON "Assignment"("teamMemberId");

-- CreateIndex
CREATE INDEX "Assignment_shiftId_idx" ON "Assignment"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_shiftId_teamMemberId_key" ON "Assignment"("shiftId", "teamMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "EventConfig_eventId_key" ON "EventConfig"("eventId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRole" ADD CONSTRAINT "ShiftRole_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPreference" ADD CONSTRAINT "ShiftPreference_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPreference" ADD CONSTRAINT "ShiftPreference_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventConfig" ADD CONSTRAINT "EventConfig_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
