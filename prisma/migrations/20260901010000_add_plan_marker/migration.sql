-- CreateTable
CREATE TABLE "PlanMarker" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanMarker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanMarker_eventId_startTime_idx" ON "PlanMarker"("eventId", "startTime");

-- AddForeignKey
ALTER TABLE "PlanMarker" ADD CONSTRAINT "PlanMarker_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
