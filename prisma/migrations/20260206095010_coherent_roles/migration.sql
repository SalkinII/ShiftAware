-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('BOOLEAN', 'SELECT', 'MULTISELECT', 'TEXT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShiftType" ADD VALUE 'BUFFER';
ALTER TYPE "ShiftType" ADD VALUE 'EXTENDED';

-- AlterTable
ALTER TABLE "ShiftTemplate" ADD COLUMN     "allowedLanes" "ShiftType"[] DEFAULT ARRAY[]::"ShiftType"[];

-- CreateTable
CREATE TABLE "EventAttributeDefinition" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "options" TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMemberAttribute" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMemberAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventAttributeDefinition_eventId_idx" ON "EventAttributeDefinition"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttributeDefinition_eventId_name_key" ON "EventAttributeDefinition"("eventId", "name");

-- CreateIndex
CREATE INDEX "TeamMemberAttribute_memberId_idx" ON "TeamMemberAttribute"("memberId");

-- CreateIndex
CREATE INDEX "TeamMemberAttribute_definitionId_idx" ON "TeamMemberAttribute"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberAttribute_memberId_definitionId_key" ON "TeamMemberAttribute"("memberId", "definitionId");

-- AddForeignKey
ALTER TABLE "EventAttributeDefinition" ADD CONSTRAINT "EventAttributeDefinition_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberAttribute" ADD CONSTRAINT "TeamMemberAttribute_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberAttribute" ADD CONSTRAINT "TeamMemberAttribute_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "EventAttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
