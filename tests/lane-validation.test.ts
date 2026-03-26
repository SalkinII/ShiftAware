import { describe, it, expect } from "vitest";
import {
  isValidLaneDrop,
  getTemplateAllowedLanes,
} from "../lib/utils/lane-validation";
import { ShiftType } from "@prisma/client";

describe("lane-validation", () => {
  describe("isValidLaneDrop", () => {
    it("returns true when template allows the target lane", () => {
      const template = {
        id: "1",
        type: ShiftType.MOBILE_TEAM,
        allowedLanes: [ShiftType.MOBILE_TEAM],
      };

      expect(isValidLaneDrop(template, ShiftType.MOBILE_TEAM)).toBe(true);
    });

    it("returns false when template does not allow the target lane", () => {
      const template = {
        id: "1",
        type: ShiftType.MOBILE_TEAM,
        allowedLanes: [ShiftType.MOBILE_TEAM],
      };

      expect(isValidLaneDrop(template, ShiftType.SUPER)).toBe(false);
    });

    it("falls back to template type when allowedLanes is empty", () => {
      const template = {
        id: "1",
        type: ShiftType.STATIONARY,
        allowedLanes: [],
      };

      expect(isValidLaneDrop(template, ShiftType.STATIONARY)).toBe(true);
      expect(isValidLaneDrop(template, ShiftType.MOBILE_TEAM)).toBe(false);
    });
  });

  describe("getTemplateAllowedLanes", () => {
    it("returns allowedLanes if defined", () => {
      const template = {
        type: ShiftType.MOBILE_TEAM,
        allowedLanes: [ShiftType.MOBILE_TEAM],
      };

      expect(getTemplateAllowedLanes(template)).toEqual([
        ShiftType.MOBILE_TEAM,
      ]);
    });

    it("returns [type] as fallback", () => {
      const template = {
        type: ShiftType.SUPER,
        allowedLanes: [],
      };

      expect(getTemplateAllowedLanes(template)).toEqual([ShiftType.SUPER]);
    });
  });
});
