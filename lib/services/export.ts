import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface ExportOptions {
  orientation?: "portrait" | "landscape";
  memberId?: string;
  includePseudonymMap?: boolean;
  title?: string;
}

export function exportScheduleToPDF(
  shifts: any[],
  options: ExportOptions = {},
) {
  const {
    orientation = "landscape",
    memberId,
    includePseudonymMap = false,
    title,
  } = options;

  // Optimized single-pass processing: filter, calculate coverage, build member map, and prepare table data
  const processedData = (() => {
    let totalCapacity = 0;
    let totalFilled = 0;
    const filteredShifts: any[] = [];
    const memberMap = new Map<string, { alias: string; avatarId?: string }>();
    let memberAlias: string | undefined;
    let eventName: string | undefined;

    // Single pass: filter shifts, calculate coverage, build member map
    for (const shift of shifts) {
      if (!eventName && shift.event?.name) {
        eventName = shift.event.name;
      }

      let assignments = shift.assignments || [];

      // Filter assignments if memberId specified
      if (memberId) {
        assignments = assignments.filter(
          (a: any) =>
            a.teamMemberId === memberId || a.teamMember?.id === memberId,
        );
        if (assignments.length === 0) continue;

        // Find member alias during filtering (first match)
        if (!memberAlias) {
          const assignment = assignments.find(
            (a: any) =>
              a.teamMember?.id === memberId || a.teamMemberId === memberId,
          );
          memberAlias = assignment?.teamMember?.alias;
        }
      }

      // Build member map for pseudonym mapping
      if (includePseudonymMap) {
        for (const assignment of assignments) {
          if (assignment.teamMember?.id) {
            const id = assignment.teamMember.id;
            if (!memberMap.has(id)) {
              memberMap.set(id, {
                alias: assignment.teamMember.alias,
                avatarId: assignment.teamMember.avatarId,
              });
            }
          }
        }
      }

      // Calculate coverage during filtering
      const capacity = shift.capacity || 0;
      const filled = assignments.length;
      totalCapacity += capacity;
      totalFilled += filled;

      filteredShifts.push({
        ...shift,
        assignments,
        _parsedStart: new Date(shift.startTime),
        _parsedEnd: new Date(shift.endTime),
        _assignmentCount: filled,
        _capacity: capacity,
      });
    }

    return {
      filteredShifts,
      totalCapacity,
      totalFilled,
      memberMap,
      memberAlias,
      eventName: title || eventName || "ShiftAware Schedule",
    };
  })();

  if (processedData.filteredShifts.length === 0) {
    throw new Error("No shifts available to export");
  }

  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  const pageWidth = doc.internal.pageSize.getWidth();
  const coverage =
    processedData.totalCapacity === 0
      ? 0
      : Math.round(
          (processedData.totalFilled / processedData.totalCapacity) * 100,
        );

  // Title
  doc.setFontSize(18);
  doc.text(processedData.eventName, 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${timestamp}`, 40, 56);
  if (memberId) {
    doc.text(
      `Scope: Member ${processedData.memberAlias ? `"${processedData.memberAlias}"` : memberId}`,
      40,
      70,
    );
  }

  // Coverage summary
  doc.setFontSize(11);
  doc.text(
    `Coverage: ${coverage}% (${processedData.totalFilled}/${processedData.totalCapacity})`,
    40,
    memberId ? 86 : 76,
  );

  // Pre-sort shifts by start time (using pre-parsed dates)
  const sortedShifts = [...processedData.filteredShifts].sort(
    (a, b) => a._parsedStart.getTime() - b._parsedStart.getTime(),
  );

  // Build table data efficiently (dates already parsed, reuse them)
  const tableData = sortedShifts.map((shift) => {
    // Use pre-parsed dates
    const startTime = format(shift._parsedStart, "MMM d, HH:mm");
    const endTime = format(shift._parsedEnd, "HH:mm");

    // Build assignment string efficiently
    const assignmentStrings: string[] = [];
    for (const assignment of shift.assignments) {
      const member = assignment.teamMember;
      if (member) {
        const str = `${member.avatarId || ""} ${member.alias || ""}`.trim();
        if (str) assignmentStrings.push(str);
      }
    }
    const assignments =
      assignmentStrings.length > 0 ? assignmentStrings.join(", ") : "None";

    // Use pre-calculated values
    const staffed = `${shift._assignmentCount}/${shift._capacity}`;
    const status =
      shift._assignmentCount >= shift._capacity
        ? "Fully Staffed"
        : shift._assignmentCount > 0
          ? "Partial"
          : "Unstaffed";

    // Cache shift type replacement
    const shiftType =
      shift.template?.name ?? shift.type?.replace("_", " ") ?? "Shift";

    return [startTime, endTime, shiftType, assignments, staffed, status];
  });

  const assignmentsWidth = Math.max(
    180,
    pageWidth - (70 + 60 + 110 + 70 + 70 + 80),
  );

  autoTable(doc, {
    startY: memberId ? 104 : 96,
    head: [["Start", "End", "Shift Type", "Assignments", "Staffing", "Status"]],
    body: tableData,
    theme: "striped",
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 60 },
      2: { cellWidth: 110 },
      3: { cellWidth: assignmentsWidth },
      4: { cellWidth: 70 },
      5: { cellWidth: 80 },
    },
    margin: { left: 40, right: 40 },
  });

  // Pseudonym map (already built during initial pass)
  if (includePseudonymMap && processedData.memberMap.size > 0) {
    const rows = Array.from(processedData.memberMap.values()).map((entry) => [
      entry.alias || "Unknown",
      entry.avatarId || "",
    ]);
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Pseudonym Mapping", 40, 40);
    autoTable(doc, {
      startY: 54,
      head: [["Alias", "Avatar"]],
      body: rows,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
  }

  // Footer (optimized: calculate text once, reuse)
  const pageCount = (doc as any).internal.getNumberOfPages();
  const footerText = `Page {page} of ${pageCount} - Privacy-first shift management`;
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      footerText.replace("{page}", String(i)),
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" },
    );
  }

  // Cache filename generation
  const filename = `${processedData.eventName.replace(/\s+/g, "_")}_Schedule_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(filename);
}
