"use client";

interface Props {
  eventId: string;
  previewData: any;
  highlightMemberId: string | null;
  onMemberSelect: (id: string | null) => void;
}

export function DistributionHeatmap(_props: Props) {
  return (
    <div className="border rounded p-3 text-sm text-gray-400">
      Heatmap placeholder
    </div>
  );
}
