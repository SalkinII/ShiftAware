# ShiftAware API Reference

All endpoints use JSON. Auth is session-based (cookie).

## Conventions

- **Base URL:** `/api`
- **Auth:** Session cookie set at login. Check with `GET /api/auth/check`.
- **Response wrapper:** All success responses: `{ "data": T }`
  Helper: `unwrapApiResponse(response)` in `lib/api-errors.ts`
- **Error format:** `{ "error": "message", "code": "ERROR_CODE" }`
- **Status codes:** 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden (status guard), 404 Not Found, 409 Conflict, 500 Server Error

---

## Authentication

Session-based authentication using HMAC-signed cookies. Two shared passwords: admin and user.

### Rate Limiting

Login attempts are rate-limited per IP address. After 5 failed attempts within 15 minutes, the endpoint returns `429 Too Many Requests` with a `Retry-After` header. The counter resets on successful login.

### `POST /api/auth/login`

**Auth required:** No
**Body:** `{ "password": string }`
**Success (200):** `{ "success": true, "isAdmin": boolean }` + sets signed session cookies
**Invalid (401):** `{ "error": "Invalid password" }`
**Rate limited (429):** `{ "error": "Too many login attempts...", "code": "RATE_LIMITED", "retryAfter": number }`

### `POST /api/auth/logout`

**Auth required:** Yes
**Response:** `{ "success": true }` + clears session cookies

### `GET /api/auth/check`

**Auth required:** No
**Response:** `{ "authenticated": boolean }`

---

## Health

### `GET /api/health`

**Auth required:** No
**Response:** `{ "data": { "status": "ok" } }`

---

## Team Members

### `GET /api/members`

**Auth required:** Yes
**Query params:**

- `eventId` (string, optional) — filter to members registered for this event
- `includeUnregistered` (boolean, optional) — when combined with eventId, also return unregistered members
- `search` (string, optional) — filter by alias
  **Response:** `{ "data": TeamMember[] }`

### `POST /api/members`

**Auth required:** Yes
**Body:** `{ "alias": string, "avatarId": string, "experienceLevel": "JUNIOR"|"INTERMEDIATE"|"SENIOR", "capabilities": ("TEAM_MEMBER"|"SHIFT_LEAD"|"SUPER")[] }`
**Response:** `{ "data": TeamMember }` (201)
**Notes:** Returns 409 if alias already exists.

### `GET /api/members/[id]`

**Auth required:** Yes
**Response:** `{ "data": TeamMember }`

### `PUT /api/members/[id]`

**Auth required:** Yes
**Body:** Partial TeamMember fields
**Response:** `{ "data": TeamMember }`

### `DELETE /api/members/[id]`

**Auth required:** Yes
**Response:** `{ "data": TeamMember }` — sets `isActive: false` (soft delete / deactivate)
**Notes:** Does not remove the record. Also removes the member's assignments, preferences, swap requests, and event registrations for all non-COMPLETED events. Completed event history is preserved. Use `DELETE /api/members/[id]/permanent` to permanently remove.

### `DELETE /api/members/[id]/permanent`

**Auth required:** Yes (admin only)
**Response:** `{ "data": { "success": true } }`
**Notes:** Permanently deletes the member and all their shift preferences, assignments, swap requests, and event registrations. Member must be deactivated (`isActive: false`) first — returns 409 otherwise.

| Status | Meaning |
| --- | --- |
| 200 | Deleted |
| 401 | Not authenticated or not admin |
| 404 | Member not found |
| 409 | Member is still active — deactivate first |
| 500 | Unexpected error |

### `GET /api/members/[id]/attributes`

**Auth required:** Yes
**Response:** `{ "data": TeamMemberAttribute[] }`

### `POST /api/members/[id]/attributes`

**Auth required:** Yes
**Body:** `{ "attributeDefinitionId": string, "value": string }`
**Response:** `{ "data": TeamMemberAttribute }` (201)

### `GET /api/members/availability`

**Auth required:** Yes
**Query params:** `eventId` (string, required)
**Response:** Availability heatmap matrix (analytical — complex nested structure)
**Notes:** Direct Prisma (complex analytical query). Not backed by service layer.

---

## Events

### `GET /api/events`

**Auth required:** Yes
**Response:** `{ "data": Event[] }`

### `POST /api/events`

**Auth required:** Yes
**Body:** `{ "name": string, "startDate": string (ISO), "endDate": string (ISO), ... }`
**Response:** `{ "data": Event }` (201)

### `GET /api/events/current`

**Auth required:** Yes
**Response:** `{ "data": Event | null }` — the most recent non-COMPLETED event

### `GET /api/events/[id]`

**Auth required:** Yes
**Response:** `{ "data": Event }`

### `PUT /api/events/[id]`

**Auth required:** Yes
**Body:** Partial Event fields
**Response:** `{ "data": Event }`

### `DELETE /api/events/[id]`

**Auth required:** Yes (admin only)
**Response:** `{ "data": { "success": true } }`
**Notes:** Permanently deletes the event and all dependent data: shifts, shift roles, assignments, shift preferences, swap requests targeting those shifts, scheduled shifts, event config, event-specific shift templates, event registrations, template assignments, and attribute definitions. Only allowed when event status is `PLANNING` or `COMPLETED`.

| Status | Meaning |
| --- | --- |
| 200 | Deleted |
| 401 | Not authenticated or not admin |
| 403 | Event status is not PLANNING or COMPLETED |
| 404 | Event not found |
| 500 | Unexpected error |

### `GET /api/events/[id]/config`

**Auth required:** Yes
**Response:** `{ "data": EventConfig }` — includes algorithmWeights, balanceThresholds, allocationRules JSON fields

### `PUT /api/events/[id]/config`

**Auth required:** Yes
**Body:** Partial EventConfig (algorithmWeights, balanceThresholds, allocationRules)
**Response:** `{ "data": EventConfig }`

### `GET /api/events/[id]/registrations`

**Auth required:** Yes
**Response:** `{ "data": EventRegistration[] }`

### `POST /api/events/[id]/registrations`

**Auth required:** Yes
**Body:** `{ "teamMemberId": string }`
**Response:** `{ "data": EventRegistration }` (201)

### `GET /api/events/[id]/registrations/[memberId]`

**Auth required:** Yes
**Response:** `{ "data": EventRegistration }`

### `PUT /api/events/[id]/registrations/[memberId]`

**Auth required:** Yes
**Body:** Partial EventRegistration
**Response:** `{ "data": EventRegistration }`

### `DELETE /api/events/[id]/registrations/[memberId]`

**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`
**Notes:** Also removes the member's assignments, preferences, and swap requests scoped to this event.

### `GET /api/events/[id]/templates`

**Auth required:** Yes
**Response:** `{ "data": { "assigned": EventTemplate[], "eventSpecific": ShiftTemplate[] } }`
**Notes:** Use `assigned` to derive lanes with `deriveLanesFromTemplates()`.

### `POST /api/events/[id]/templates`

**Auth required:** Yes
**Body:** `{ "templateId": string }`
**Response:** `{ "data": EventTemplate }` (201)

### `DELETE /api/events/[id]/templates/[templateId]`

**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

### `GET /api/events/[id]/attributes`

**Auth required:** Yes
**Response:** `{ "data": EventAttributeDefinition[] }`

### `POST /api/events/[id]/attributes`

**Auth required:** Yes
**Body:** `{ "name": string, "type": string, "options": string[] }`
**Response:** `{ "data": EventAttributeDefinition }` (201)

### `PUT /api/events/[id]/attributes/[attrId]`

**Auth required:** Yes
**Body:** Partial EventAttributeDefinition
**Response:** `{ "data": EventAttributeDefinition }`

### `DELETE /api/events/[id]/attributes/[attrId]`

**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

### `POST /api/events/[id]/transition`

**Auth required:** Yes
**Body:** `{ "targetStatus": "PLANNING"|"OPEN_FOR_PREFERENCES"|"ASSIGNING"|"FINALIZED"|"COMPLETED" }`
**Response:** `{ "data": Event }`
**Notes:** Only one-step transitions allowed (forward or backward). Validates prerequisites (e.g. at least 1 shift to publish). Returns 400 for invalid transition.

---

## Shifts

### `GET /api/shifts`

**Auth required:** Yes
**Query params:**

- `eventId` (string, required) — filter by event
- `startDate`, `endDate` (string, ISO, optional) — date range filter
  **Response:** `{ "data": ShiftWithRelations[] }` — includes template, assignments, preferences

### `POST /api/shifts`

**Auth required:** Yes
**Status guard:** Requires PLANNING
**Body:** `{ "eventId": string, "templateId": string, "startTime": string (ISO), "endTime": string (ISO), "capacity": number, "desirabilityScore": number }`
**Response:** `{ "data": Shift }` (201)

### `GET /api/shifts/[id]`

**Auth required:** Yes
**Response:** `{ "data": Shift }`

### `PUT /api/shifts/[id]`

**Auth required:** Yes
**Status guard:** Requires PLANNING
**Body:** Partial Shift fields
**Response:** `{ "data": Shift }`

### `DELETE /api/shifts/[id]`

**Auth required:** Yes
**Status guard:** Requires PLANNING
**Response:** `{ "data": { "success": true } }`

### `DELETE /api/shifts/[id]/cleanup`

**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`
**Notes:** Force-deletes orphaned/problematic shifts regardless of event status. Maintenance tool — bypasses status guard.

### `GET /api/shifts/templates`

**Auth required:** Yes
**Response:** `{ "data": ShiftTemplate[] }`

### `POST /api/shifts/templates`

**Auth required:** Yes
**Body:** `{ "name": string, "type": string, "color": string, "laneOrder": number, "defaultCapacity": number, "defaultDurationMinutes": number }`
**Response:** `{ "data": ShiftTemplate }` (201)

### `GET /api/shifts/templates/[id]`

**Auth required:** Yes
**Response:** `{ "data": ShiftTemplate }`

### `PUT /api/shifts/templates/[id]`

**Auth required:** Yes
**Body:** Partial ShiftTemplate
**Response:** `{ "data": ShiftTemplate }`

### `DELETE /api/shifts/templates/[id]`

**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

### `POST /api/shifts/templates/[id]/schedule`

**Auth required:** Yes
**Body:** `{ "eventId": string, "dates": string[] (ISO dates) }`
**Response:** `{ "data": Shift[] }` — bulk-creates shifts from template

### `POST /api/shifts/from-scheduled/[scheduledId]`

**Auth required:** Yes
**Response:** `{ "data": Shift }` — converts a scheduled template instance to an actual shift

---

## Preferences

### `GET /api/preferences`

**Auth required:** Yes
**Query params:** `eventId` (string), `teamMemberId` (string), `shiftId` (string) — any combination
**Response:** `{ "data": ShiftPreference[] }`

### `POST /api/preferences`

**Auth required:** Yes
**Status guard:** Requires OPEN_FOR_PREFERENCES
**Body:** `{ "shiftId": string, "teamMemberId": string, "wantLevel": "WANT"|"DONT_WANT" }`
**Response:** `{ "data": ShiftPreference }` — upserts (creates or updates existing)

### `DELETE /api/preferences`

**Auth required:** Yes
**Query params:** `shiftId` (string), `teamMemberId` (string) — both required
**Response:** `{ "data": { "success": true } }`

---

## Assignments

### `GET /api/assignments`

**Auth required:** Yes
**Query params:** `eventId` (string, optional), `teamMemberId` (string, optional)
**Response:** `{ "data": Assignment[] }`

### `POST /api/assignments`

**Auth required:** Yes
**Status guard:** ASSIGNMENT_ALGORITHM (bulk run) or ASSIGNMENT_MANUAL (single)
**Body (algorithm run):** `{ "eventId": string, "preview"?: boolean }` — runs full allocation; `preview: true` returns proposed assignments without DB writes
**Body (manual):** `{ "eventId": string, "assignments": [{ "shiftId": string, "teamMemberId": string, "role": "TEAM_MEMBER"|"SHIFT_LEAD"|"SUPER", "assignmentType": "MANUAL" }] }`
**Response:** `{ "data": AlgorithmResult }` for algorithm run; `{ "data": { "assignments": Assignment[] } }` (201) for manual
**Notes:** `preview: true` returns proposed assignments without saving. AlgorithmResult includes assignments, violations array, scores map, explanations map.

### `DELETE /api/assignments`

**Auth required:** Yes
**Query params:** `id` (string, required)
**Response:** `{ "data": { "deleted": true } }`

### `POST /api/assignments/swap`

**Auth required:** Yes
**Body:** `{ "fromAssignmentId": string, "toAssignmentId": string }`
**Response:** `{ "data": { "fromAssignment": Assignment, "toAssignment": Assignment } }`
**Notes:** Direct swap of two assignments. Different from swap-request workflow.

---

## Swap Requests

### `GET /api/swap-requests`

**Auth required:** Yes
**Query params:** `eventId` (string, optional), `memberId` (string, optional)
**Response:** `{ "data": SwapRequest[] }`

### `POST /api/swap-requests`

**Auth required:** Yes
**Body:** `{ "fromAssignmentId": string, "toShiftId": string }`
**Response:** `{ "data": SwapRequest }`
**Notes:** Auto-matches with complementary pending request if one exists (both become MATCHED status).

### `GET /api/swap-requests/[id]`

**Auth required:** Yes
**Response:** `{ "data": SwapRequest }`

### `PUT /api/swap-requests/[id]`

**Auth required:** Yes
**Body:** `{ "status": "APPROVED"|"REJECTED"|"CANCELLED" }`
**Response:** `{ "data": SwapRequest }`
**Notes:** APPROVED on a MATCHED request executes the swap (swaps assignments + marks both approved).

When `status: "DECLINED"` is sent by an admin, the request is **hard-deleted** with matched-pair
cleanup: if the request was MATCHED, the partner request is reverted to PENDING (their swap request
survives) and the declined request is removed.

### `DELETE /api/swap-requests/[id]`

**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

**Hard-deletes** a PENDING swap request. The request must be in PENDING status; other statuses return 400.
Previously soft-cancelled; now permanently removed consistent with the approved path.

---

## Audit

### `GET /api/audit`

**Auth required:** Yes
**Query params:** `search` (string), `action` ("CREATE"|"UPDATE"|"DELETE"), `entityType` (string), `page` (number)
**Response:** `{ "data": AuditLog[] }`

### `POST /api/audit/rollback`

**Auth required:** Yes
**Body:** `{ "auditLogId": string }`
**Response:** `{ "data": { "success": true } }`
**Notes:** Restores entity to its pre-change state using the `before` snapshot in the audit log.

---

## Analytical Utilities

These routes contain embedded business logic with direct Prisma access (not backed by service layer).

### `GET /api/members/availability`

Availability heatmap matrix by member and time slot. Complex analytical query.
**Query params:** `eventId` (string, required)

### `GET /api/conflicts`

Detect constraint violations across all assignments for an event.
**Query params:** `eventId` (string, required)

### `POST /api/conflicts/resolve`

Apply conflict resolution actions.
**Body:** `{ "conflictId": string, "action": string, "eventId": string }`
