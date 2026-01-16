-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ShiftType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "priority" "ShiftPriority" NOT NULL DEFAULT 'CORE',
    "desirabilityScore" INTEGER NOT NULL DEFAULT 3,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplateRole" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ShiftTemplateRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledShift" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftTemplateRole_templateId_role_key" ON "ShiftTemplateRole"("templateId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledShift_shiftId_key" ON "ScheduledShift"("shiftId");

-- CreateIndex
CREATE INDEX "ScheduledShift_eventId_date_idx" ON "ScheduledShift"("eventId", "date");

-- CreateIndex
CREATE INDEX "ScheduledShift_templateId_idx" ON "ScheduledShift"("templateId");

-- AddForeignKey
ALTER TABLE "ShiftTemplateRole" ADD CONSTRAINT "ShiftTemplateRole_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
