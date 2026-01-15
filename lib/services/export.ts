import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface ExportOptions {
  orientation?: "portrait" | "landscape";
  memberId?: string;
  includePseudonymMap?: boolean;
  title?: string;
}

export function exportScheduleToPDF(shifts: any[], options: ExportOptions = {}) {
  const { orientation = "landscape", memberId, includePseudonymMap = false, title } = options;

  const filteredShifts = memberId
    ? shifts
        .map((shift) => ({
          ...shift,
          assignments: (shift.assignments || []).filter((a: any) => a.teamMemberId === memberId || a.teamMember?.id === memberId),
        }))
        .filter((shift) => shift.assignments?.length > 0)
    : shifts;

  if (filteredShifts.length === 0) {
    throw new Error("No shifts available to export");
  }

  const doc = new jsPDF({ orientation });
  const eventName = title || filteredShifts[0]?.event?.name || "ShiftAware Schedule";
  const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  const memberAlias =
    memberId &&
    filteredShifts
      .flatMap((s: any) => s.assignments || [])
      .find((a: any) => a.teamMember?.id === memberId || a.teamMemberId === memberId)?.teamMember?.alias;

  // Title
  doc.setFontSize(18);
  doc.text(eventName, 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${timestamp}`, 14, 28);
  if (memberId) {
    doc.text(`Scope: Member ${memberAlias ? `"${memberAlias}"` : memberId}`, 14, 32);
  }

  // Coverage summary
  const totalCapacity = filteredShifts.reduce((acc: number, shift: any) => acc + (shift.capacity || 0), 0);
  const totalFilled = filteredShifts.reduce((acc: number, shift: any) => acc + ((shift.assignments || []).length || 0), 0);
  const coverage = totalCapacity === 0 ? 0 : Math.round((totalFilled / totalCapacity) * 100);
  doc.setFontSize(11);
  doc.text(`Coverage: ${coverage}% (${totalFilled}/${totalCapacity})`, 14, memberId ? 38 : 34);

  // Table Data
  const tableData = filteredShifts
    .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .map((shift: any) => {
      const startTime = format(new Date(shift.startTime), "MMM d, HH:mm");
      const endTime = format(new Date(shift.endTime), "HH:mm");
      const assignments = shift.assignments
        ?.map((a: any) => `${a.teamMember?.avatarId || ""} ${a.teamMember?.alias || ""}`.trim())
        .filter(Boolean)
        .join(", ") || "None";
      const staffed = `${shift.assignments?.length || 0}/${shift.capacity}`;
      const status = (shift.assignments?.length || 0) >= shift.capacity ? "Fully Staffed" : (shift.assignments?.length || 0) > 0 ? "Partial" : "Unstaffed";

      return [
        startTime,
        endTime,
        shift.type?.replace("_", " ") || "Shift",
        assignments,
        staffed,
        status,
      ];
    });

  autoTable(doc, {
    startY: 40,
    head: [["Start", "End", "Shift Type", "Assignments", "Staffing", "Status"]],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 40 },
  });

  if (includePseudonymMap) {
    const mapping = new Map<string, { alias: string; avatarId?: string }>();
    filteredShifts.forEach((shift: any) => {
      shift.assignments?.forEach((a: any) => {
        if (a.teamMember?.id) {
          mapping.set(a.teamMember.id, { alias: a.teamMember.alias, avatarId: a.teamMember.avatarId });
        }
      });
    });
    const rows = Array.from(mapping.values()).map((entry) => [entry.alias || "Unknown", entry.avatarId || ""]);
    if (rows.length > 0) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text("Pseudonym Mapping", 14, 20);
      autoTable(doc, {
        startY: 26,
        head: [["Alias", "Avatar"]],
        body: rows,
        headStyles: { fillColor: [15, 23, 42] },
      });
    }
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount} - Privacy-first shift management`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`${eventName.replace(/\s+/g, "_")}_Schedule_${format(new Date(), "yyyyMMdd")}.pdf`);
}

