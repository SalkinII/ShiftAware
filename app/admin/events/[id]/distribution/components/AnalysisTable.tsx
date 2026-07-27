"use client";

interface Props {
  eventId: string;
  onMemberSelect: (id: string | null) => void;
  selectedMemberId: string | null;
}

export function AnalysisTable(_props: Props) {
  return (
    <div className="border rounded p-3 text-sm text-gray-400">
      Analysis placeholder
    </div>
  );
}
