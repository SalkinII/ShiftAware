/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportScheduleToPDF } from "../lib/services/export";

const textMock = vi.fn();
const setFontSizeMock = vi.fn();
const setTextColorMock = vi.fn();
const addPageMock = vi.fn();
const saveMock = vi.fn();
const setPageMock = vi.fn();
let lastInstanceOpts: any = {};
let pageCount = 1;

const autoTableMock = vi.fn();

vi.mock("jspdf", () => {
  return {
    default: class JsPDFMock {
      internal = {
        getNumberOfPages: () => pageCount,
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      };
      constructor(opts?: any) {
        lastInstanceOpts = opts;
      }
      text = textMock;
      setFontSize = setFontSizeMock;
      setTextColor = setTextColorMock;
      addPage = addPageMock;
      save = saveMock;
      setPage = setPageMock;
    },
  };
});

vi.mock("jspdf-autotable", () => ({
  default: (...args: any[]) => autoTableMock(...args),
}));

const sampleShifts = [
  {
    id: "s1",
    type: "MOBILE_TEAM_1",
    startTime: "2026-06-26T10:00:00Z",
    endTime: "2026-06-26T12:00:00Z",
    capacity: 2,
    assignments: [
      {
        id: "a1",
        teamMemberId: "m1",
        teamMember: { id: "m1", alias: "Alpha", avatarId: "A" },
        assignmentType: "ALGORITHM",
        role: "TEAM_MEMBER",
      },
    ],
    event: { name: "Starlight" },
  },
  {
    id: "s2",
    type: "STATIONARY",
    startTime: "2026-06-27T10:00:00Z",
    endTime: "2026-06-27T12:00:00Z",
    capacity: 1,
    assignments: [
      {
        id: "a2",
        teamMemberId: "m2",
        teamMember: { id: "m2", alias: "Bravo", avatarId: "B" },
        assignmentType: "ALGORITHM",
        role: "TEAM_MEMBER",
      },
    ],
    event: { name: "Starlight" },
  },
];

beforeEach(() => {
  textMock.mockClear();
  setFontSizeMock.mockClear();
  setTextColorMock.mockClear();
  addPageMock.mockClear();
  saveMock.mockClear();
  autoTableMock.mockClear();
  setPageMock.mockClear();
  lastInstanceOpts = {};
  pageCount = 1;
});

describe("exportScheduleToPDF", () => {
  it("throws when no shifts are provided", () => {
    expect(() => exportScheduleToPDF([], { orientation: "portrait" })).toThrow("No shifts available to export");
  });

  it("respects orientation and filters to member scope", () => {
    exportScheduleToPDF(sampleShifts, { orientation: "portrait", memberId: "m1" });
    expect(lastInstanceOpts.orientation).toBe("portrait");

    const [, tableCfg] = autoTableMock.mock.calls[0];
    expect(tableCfg.body).toHaveLength(1);
    expect(tableCfg.body[0][2]).toContain("MOBILE TEAM");

    const scopeLine = textMock.mock.calls.find(([text]) => (text as string).startsWith("Scope: Member"));
    expect(scopeLine?.[0]).toContain("Alpha");
  });

  it("adds pseudonym mapping sheet when requested", () => {
    exportScheduleToPDF(sampleShifts, { includePseudonymMap: true });
    expect(addPageMock).toHaveBeenCalledTimes(1);
    expect(autoTableMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const [, mappingCfg] = autoTableMock.mock.calls[1];
    expect(mappingCfg.head[0]).toEqual(["Alias", "Avatar"]);
  });

  it("includes coverage summary text", () => {
    exportScheduleToPDF(sampleShifts);
    const coverageLine = textMock.mock.calls.find(([text]) => (text as string).startsWith("Coverage:"));
    expect(coverageLine?.[0]).toContain("Coverage:");
  });
});

