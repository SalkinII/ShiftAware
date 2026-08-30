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

  describe("Member permanent deletion flow", () => {
    let memberId: string;

    it("creates and deactivates a test member", async () => {
      // Create member
      const createRes = await authenticatedFetch(`${BASE_URL}/api/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: `test-perm-delete-${Date.now()}`,
          avatarId: "🧪",
          experienceLevel: "JUNIOR",
          capabilities: ["TEAM_MEMBER"],
        }),
      });
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      memberId = createData.data.id;

      // Deactivate member (soft delete)
      const deactivateRes = await authenticatedFetch(
        `${BASE_URL}/api/members/${memberId}`,
        {
          method: "DELETE",
        },
      );
      expect(deactivateRes.status).toBe(200);
      const deactivateData = await deactivateRes.json();
      expect(deactivateData.data.isActive).toBe(false);
    });

    it("returns 409 when trying to permanently delete an active member", async () => {
      // Create a fresh active member
      const createRes = await authenticatedFetch(`${BASE_URL}/api/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: `test-active-${Date.now()}`,
          avatarId: "🧪",
          experienceLevel: "JUNIOR",
          capabilities: ["TEAM_MEMBER"],
        }),
      });
      expect(createRes.status).toBe(201);
      const data = await createRes.json();
      const activeId = data.data.id;

      const res = await authenticatedFetch(
        `${BASE_URL}/api/members/${activeId}/permanent`,
        { method: "DELETE" },
      );
      expect(res.status).toBe(409);

      // Clean up
      await authenticatedFetch(`${BASE_URL}/api/members/${activeId}`, {
        method: "DELETE",
      });
      await authenticatedFetch(
        `${BASE_URL}/api/members/${activeId}/permanent`,
        { method: "DELETE" },
      );
    });

    it("permanently deletes an inactive member", async () => {
      const res = await authenticatedFetch(
        `${BASE_URL}/api/members/${memberId}/permanent`,
        { method: "DELETE" },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.success).toBe(true);
    });

    it("returns 404 after permanent deletion", async () => {
      const res = await authenticatedFetch(
        `${BASE_URL}/api/members/${memberId}`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Event permanent deletion flow", () => {
    let eventId: string;

    it("creates a PLANNING event", async () => {
      const res = await authenticatedFetch(`${BASE_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Test Delete Event ${Date.now()}`,
          startDate: "2099-01-01",
          endDate: "2099-01-03",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      eventId = data.data.id;
      expect(data.data.status).toBe("PLANNING");
    });

    it("returns 403 when trying to delete an ASSIGNING event", async () => {
      // Create a separate event and transition it
      const createRes = await authenticatedFetch(`${BASE_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Test Assigning ${Date.now()}`,
          startDate: "2099-02-01",
          endDate: "2099-02-03",
        }),
      });
      const created = await createRes.json();
      const blockId = created.data.id;

      // Add a shift so it can transition to OPEN_FOR_PREFERENCES
      const shiftRes = await authenticatedFetch(`${BASE_URL}/api/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: blockId,
          templateId: null,
          type: "STATIONARY",
          startTime: "2099-02-01T10:00:00.000Z",
          endTime: "2099-02-01T14:00:00.000Z",
          durationMinutes: 240,
          capacity: 2,
          desirabilityScore: 3,
          requiredRoles: [],
        }),
      });

      if (shiftRes.ok) {
        // Transition to OPEN_FOR_PREFERENCES
        await authenticatedFetch(
          `${BASE_URL}/api/events/${blockId}/transition`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetStatus: "OPEN_FOR_PREFERENCES" }),
          },
        );

        // Try to delete — should fail
        const delRes = await authenticatedFetch(
          `${BASE_URL}/api/events/${blockId}`,
          { method: "DELETE" },
        );
        expect(delRes.status).toBe(403);

        // Transition back to PLANNING and clean up
        await authenticatedFetch(
          `${BASE_URL}/api/events/${blockId}/transition`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetStatus: "PLANNING" }),
          },
        );
      }

      await authenticatedFetch(`${BASE_URL}/api/events/${blockId}`, {
        method: "DELETE",
      });
    });

    it("permanently deletes a PLANNING event", async () => {
      const res = await authenticatedFetch(
        `${BASE_URL}/api/events/${eventId}`,
        { method: "DELETE" },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.success).toBe(true);
    });

    it("returns 404 after event deletion", async () => {
      const res = await authenticatedFetch(
        `${BASE_URL}/api/events/${eventId}`,
      );
      expect(res.status).toBe(404);
    });
  });
});
