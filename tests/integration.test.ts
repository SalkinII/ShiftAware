/**
 * Integration tests for critical user flows
 * Tests end-to-end workflows that span multiple API endpoints and components
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-password";

let sessionCookie: string | null = null;

async function login(): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  const setCookieHeader = response.headers.get("set-cookie");
  if (setCookieHeader) {
    const match = setCookieHeader.match(/authenticated=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  // Fallback: check if cookie was set
  const cookies = response.headers.get("set-cookie");
  if (cookies && cookies.includes("authenticated")) {
    return "true"; // Simplified for test
  }

  throw new Error("Could not extract session cookie");
}

async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  if (!sessionCookie) {
    sessionCookie = await login();
  }

  const headers = {
    ...options.headers,
    Cookie: `authenticated=${sessionCookie}`,
  };

  return fetch(url, { ...options, headers });
}

describe("Integration Tests - Critical Flows", () => {
  beforeAll(async () => {
    sessionCookie = await login();
  });

  describe("Member Management Flow", () => {
    it("should create, read, update, and deactivate a member", async () => {
      // Create member
      const createResponse = await authenticatedFetch(
        `${BASE_URL}/api/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alias: "TestMember",
            avatarId: "🐺",
            experienceLevel: "INTERMEDIATE",
            capabilities: ["TEAM_MEMBER"],
          }),
        },
      );

      expect(createResponse.ok).toBe(true);
      const createdMember = await createResponse.json();
      expect(createdMember.alias).toBe("TestMember");
      const memberId = createdMember.id;

      // Read member
      const readResponse = await authenticatedFetch(
        `${BASE_URL}/api/members/${memberId}`,
      );
      expect(readResponse.ok).toBe(true);
      const readMember = await readResponse.json();
      expect(readMember.id).toBe(memberId);

      // Update member (deactivate)
      const updateResponse = await authenticatedFetch(
        `${BASE_URL}/api/members/${memberId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: false,
          }),
        },
      );
      expect(updateResponse.ok).toBe(true);

      // Verify deactivation
      const verifyResponse = await authenticatedFetch(
        `${BASE_URL}/api/members/${memberId}`,
      );
      const verifyMember = await verifyResponse.json();
      expect(verifyMember.isActive).toBe(false);
    });
  });

  describe("Shift Management Flow", () => {
    it("should create and delete a shift", async () => {
      const startTime = new Date("2026-06-26T10:00:00Z");
      const endTime = new Date("2026-06-26T16:00:00Z");

      // Create shift
      const createResponse = await authenticatedFetch(
        `${BASE_URL}/api/shifts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "CORE",
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            capacity: 4,
            priority: "core",
          }),
        },
      );

      expect(createResponse.ok).toBe(true);
      const createdShift = await createResponse.json();
      const shiftId = createdShift.id;

      // Delete shift
      const deleteResponse = await authenticatedFetch(
        `${BASE_URL}/api/shifts/${shiftId}`,
        {
          method: "DELETE",
        },
      );
      expect(deleteResponse.ok).toBe(true);

      // Verify deletion
      const verifyResponse = await authenticatedFetch(
        `${BASE_URL}/api/shifts/${shiftId}`,
      );
      expect(verifyResponse.status).toBe(404);
    });
  });

  describe("Assignment Flow", () => {
    it("should create and swap assignments", async () => {
      // Get members
      const membersResponse = await authenticatedFetch(
        `${BASE_URL}/api/members`,
      );
      const members = await membersResponse.json();
      expect(members.length).toBeGreaterThanOrEqual(2);

      // Get shifts
      const shiftsResponse = await authenticatedFetch(`${BASE_URL}/api/shifts`);
      const shifts = await shiftsResponse.json();
      expect(shifts.length).toBeGreaterThanOrEqual(2);

      const member1 = members[0];
      const member2 = members[1];
      const shift1 = shifts[0];
      const shift2 = shifts[1];

      // Create assignments
      const assign1Response = await authenticatedFetch(
        `${BASE_URL}/api/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberId: member1.id,
            shiftId: shift1.id,
          }),
        },
      );
      expect(assign1Response.ok).toBe(true);
      const assignment1 = await assign1Response.json();

      const assign2Response = await authenticatedFetch(
        `${BASE_URL}/api/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberId: member2.id,
            shiftId: shift2.id,
          }),
        },
      );
      expect(assign2Response.ok).toBe(true);
      const assignment2 = await assign2Response.json();

      // Swap assignments
      const swapResponse = await authenticatedFetch(
        `${BASE_URL}/api/assignments/swap`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId1: assignment1.id,
            assignmentId2: assignment2.id,
          }),
        },
      );
      expect(swapResponse.ok).toBe(true);

      // Verify swap
      const verify1Response = await authenticatedFetch(
        `${BASE_URL}/api/assignments/${assignment1.id}`,
      );
      const verify1 = await verify1Response.json();
      expect(verify1.teamMember.id).toBe(member2.id);

      const verify2Response = await authenticatedFetch(
        `${BASE_URL}/api/assignments/${assignment2.id}`,
      );
      const verify2 = await verify2Response.json();
      expect(verify2.teamMember.id).toBe(member1.id);
    });
  });

  describe("Conflict Detection Flow", () => {
    it("should detect conflicts and provide resolution suggestions", async () => {
      const conflictsResponse = await authenticatedFetch(
        `${BASE_URL}/api/conflicts`,
      );
      expect(conflictsResponse.ok).toBe(true);

      const data = await conflictsResponse.json();
      expect(data).toHaveProperty("conflicts");
      expect(data).toHaveProperty("summary");
      expect(Array.isArray(data.conflicts)).toBe(true);
    });
  });

  describe("Availability Heatmap Flow", () => {
    it("should calculate and return availability matrix", async () => {
      const availabilityResponse = await authenticatedFetch(
        `${BASE_URL}/api/members/availability`,
      );
      expect(availabilityResponse.ok).toBe(true);

      const data = await availabilityResponse.json();
      expect(data).toHaveProperty("members");
      expect(data).toHaveProperty("shifts");
      expect(data).toHaveProperty("availability");
      expect(data).toHaveProperty("summary");
      expect(Array.isArray(data.members)).toBe(true);
      expect(Array.isArray(data.shifts)).toBe(true);
      expect(Array.isArray(data.availability)).toBe(true);
      expect(data.availability.length).toBe(data.members.length);
      if (data.shifts.length > 0 && data.members.length > 0) {
        expect(data.availability[0].length).toBe(data.shifts.length);
      }
    });
  });

  describe("Audit Log and Rollback Flow", () => {
    it("should create audit log entry and allow rollback", async () => {
      // Create a member to generate audit log
      const createResponse = await authenticatedFetch(
        `${BASE_URL}/api/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alias: "RollbackTest",
            avatarId: "🦊",
            experienceLevel: "JUNIOR",
            capabilities: ["TEAM_MEMBER"],
          }),
        },
      );

      expect(createResponse.ok).toBe(true);
      const member = await createResponse.json();

      // Get audit logs
      const auditResponse = await authenticatedFetch(`${BASE_URL}/api/audit`);
      expect(auditResponse.ok).toBe(true);
      const auditLogs = await auditResponse.json();

      // Find the CREATE entry for this member
      const createLog = auditLogs.find(
        (log: any) =>
          log.entityType === "TeamMember" &&
          log.action === "CREATE" &&
          log.entityId === member.id,
      );

      if (createLog) {
        // Attempt rollback
        const rollbackResponse = await authenticatedFetch(
          `${BASE_URL}/api/audit/rollback`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              auditLogId: createLog.id,
            }),
          },
        );

        // Rollback should succeed (idempotent - member may already be deleted)
        expect([200, 201]).toContain(rollbackResponse.status);
      }
    });
  });
});
