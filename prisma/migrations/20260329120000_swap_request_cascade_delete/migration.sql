-- AlterForeignKey: cascade delete SwapRequests when Assignment is deleted
ALTER TABLE "SwapRequest" DROP CONSTRAINT "SwapRequest_fromAssignmentId_fkey";
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_fromAssignmentId_fkey" FOREIGN KEY ("fromAssignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
