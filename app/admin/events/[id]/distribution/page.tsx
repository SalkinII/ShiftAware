import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { DistributionControlCenter } from "./components/DistributionControlCenter";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DistributionPage({ params }: Props) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { config: true },
  });
  if (!event) return notFound();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Distribution Control Center</h1>
        <span className="text-sm text-gray-500">{event.name}</span>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <DistributionControlCenter
          eventId={id}
          eventStatus={event.status}
          eventName={event.name}
        />
      </Suspense>
    </div>
  );
}
