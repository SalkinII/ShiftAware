-- AlterTable
ALTER TABLE "EventConfig" ADD COLUMN     "bufferDaysAfter" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "bufferDaysBefore" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;
