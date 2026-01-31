import { describe, it, expect } from 'vitest';
import { isValidLaneDrop, getTemplateAllowedLanes } from '../lib/utils/lane-validation';
import { ShiftType } from '@prisma/client';

describe('lane-validation', () => {
  describe('isValidLaneDrop', () => {
    it('returns true when template allows the target lane', () => {
      const template = {
        id: '1',
        type: ShiftType.MOBILE_TEAM_1,
        allowedLanes: [ShiftType.MOBILE_TEAM_1, ShiftType.MOBILE_TEAM_2],
      };

      expect(isValidLaneDrop(template, ShiftType.MOBILE_TEAM_1)).toBe(true);
      expect(isValidLaneDrop(template, ShiftType.MOBILE_TEAM_2)).toBe(true);
    });

    it('returns false when template does not allow the target lane', () => {
      const template = {
        id: '1',
        type: ShiftType.MOBILE_TEAM_1,
        allowedLanes: [ShiftType.MOBILE_TEAM_1],
      };

      expect(isValidLaneDrop(template, ShiftType.EXECUTIVE)).toBe(false);
    });

    it('falls back to template type when allowedLanes is empty', () => {
      const template = {
        id: '1',
        type: ShiftType.STATIONARY,
        allowedLanes: [],
      };

      expect(isValidLaneDrop(template, ShiftType.STATIONARY)).toBe(true);
      expect(isValidLaneDrop(template, ShiftType.MOBILE_TEAM_1)).toBe(false);
    });
  });

  describe('getTemplateAllowedLanes', () => {
    it('returns allowedLanes if defined', () => {
      const template = {
        type: ShiftType.MOBILE_TEAM_1,
        allowedLanes: [ShiftType.MOBILE_TEAM_1, ShiftType.MOBILE_TEAM_2],
      };

      expect(getTemplateAllowedLanes(template)).toEqual([ShiftType.MOBILE_TEAM_1, ShiftType.MOBILE_TEAM_2]);
    });

    it('returns [type] as fallback', () => {
      const template = {
        type: ShiftType.EXECUTIVE,
        allowedLanes: [],
      };

      expect(getTemplateAllowedLanes(template)).toEqual([ShiftType.EXECUTIVE]);
    });
  });
});
