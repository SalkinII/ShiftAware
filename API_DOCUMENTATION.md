# ShiftAware API Documentation

**Version:** 1.0.0  
**Base URL:** `/api`

All API endpoints require authentication via session cookie (`authenticated=true`). Unauthenticated requests return `401 Unauthorized`.

---

## Authentication

### POST `/api/auth/login`
Authenticate with admin password.

**Request Body:**
```json
{
  "password": "your_admin_password"
}
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

Sets `authenticated=true` cookie on success.

---

### GET `/api/auth/check`
Check authentication status.

**Response:** `200 OK`
```json
{
  "authenticated": true
}
```

---

### POST `/api/auth/logout`
Log out current session.

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## Team Members

### GET `/api/members`
Get all team members.

**Response:** `200 OK`
```json
[
  {
    "id": "string",
    "alias": "string",
    "avatarId": "string",
    "experienceLevel": "JUNIOR" | "INTERMEDIATE" | "SENIOR",
    "genderRole": "MALE" | "FEMALE" | "OTHER",
    "isActive": true,
    "preferences": [...],
    "assignments": [...]
  }
]
```

---

### POST `/api/members`
Create a new team member.

**Request Body:**
```json
{
  "alias": "string",
  "avatarId": "string",
  "experienceLevel": "JUNIOR" | "INTERMEDIATE" | "SENIOR",
  "genderRole": "MALE" | "FEMALE" | "OTHER",
  "capabilities": ["TEAM_MEMBER", "SHIFT_LEAD"]
}
```

**Response:** `201 Created`
```json
{
  "id": "string",
  "alias": "string",
  ...
}
```

**Errors:**
- `400` - Validation error (duplicate alias, invalid data)
- `409` - Conflict (alias already exists)

---

### GET `/api/members/[id]`
Get a specific team member.

**Response:** `200 OK`
```json
{
  "id": "string",
  "alias": "string",
  ...
}
```

**Errors:**
- `404` - Member not found

---

### PUT `/api/members/[id]`
Update a team member.

**Request Body:** Same as POST, all fields optional.

**Response:** `200 OK`
```json
{
  "id": "string",
  ...
}
```

**Errors:**
- `404` - Member not found
- `409` - Conflict (alias already exists)

---

### DELETE `/api/members/[id]`
Delete a team member (soft delete: sets `isActive=false`).

**Response:** `200 OK`
```json
{
  "id": "string",
  ...
}
```

**Errors:**
- `404` - Member not found

---

## Shifts

### GET `/api/shifts`
Get all shifts, optionally filtered by event.

**Query Parameters:**
- `eventId` (optional) - Filter by event ID

**Response:** `200 OK`
```json
[
  {
    "id": "string",
    "eventId": "string",
    "type": "MOBILE_TEAM_1" | "MOBILE_TEAM_2" | "STATIONARY" | ...,
    "startTime": "2026-06-26T10:00:00.000Z",
    "endTime": "2026-06-26T16:00:00.000Z",
    "durationMinutes": 360,
    "priority": "CORE" | "OPTIONAL",
    "desirabilityScore": 1-5,
    "capacity": 2,
    "assignments": [...],
    "requiredRoles": [...]
  }
]
```

---

### POST `/api/shifts`
Create a new shift.

**Request Body:**
```json
{
  "eventId": "string",
  "type": "MOBILE_TEAM_1",
  "startTime": "2026-06-26T10:00:00.000Z",
  "endTime": "2026-06-26T16:00:00.000Z",
  "durationMinutes": 360,
  "priority": "CORE",
  "desirabilityScore": 3,
  "capacity": 2,
  "requiredRoles": [
    { "role": "TEAM_MEMBER", "count": 1 }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": "string",
  ...
}
```

**Errors:**
- `400` - Validation error (invalid dates, duration mismatch, etc.)

---

### GET `/api/shifts/[id]`
Get a specific shift.

**Response:** `200 OK`
```json
{
  "id": "string",
  ...
}
```

**Errors:**
- `404` - Shift not found

---

### PUT `/api/shifts/[id]`
Update a shift.

**Request Body:** Same as POST, all fields optional.

**Response:** `200 OK`
```json
{
  "id": "string",
  ...
}
```

**Errors:**
- `404` - Shift not found
- `400` - Validation error

---

### DELETE `/api/shifts/[id]`
Delete a shift.

**Response:** `200 OK`
```json
{
  "id": "string",
  ...
}
```

**Errors:**
- `404` - Shift not found
- `409` - Conflict (shift has existing assignments)

---

## Preferences

### GET `/api/preferences`
Get all preferences, optionally filtered by member or shift.

**Query Parameters:**
- `memberId` (optional) - Filter by member ID
- `shiftId` (optional) - Filter by shift ID

**Response:** `200 OK`
```json
[
  {
    "id": "string",
    "teamMemberId": "string",
    "shiftId": "string",
    "priority": 1-5,
    "teamMember": {...},
    "shift": {...}
  }
]
```

---

### POST `/api/preferences`
Create or update a preference.

**Request Body:**
```json
{
  "teamMemberId": "string",
  "shiftId": "string",
  "priority": 1
}
```

**Response:** `201 Created` or `200 OK`
```json
{
  "id": "string",
  ...
}
```

**Errors:**
- `404` - Member or shift not found
- `400` - Validation error (conflicting shifts, invalid priority)

---

## Assignments

### GET `/api/assignments`
Get all assignments, optionally filtered by event.

**Query Parameters:**
- `eventId` (optional) - Filter by event ID

**Response:** `200 OK`
```json
[
  {
    "id": "string",
    "shiftId": "string",
    "teamMemberId": "string",
    "role": "TEAM_MEMBER" | "SHIFT_LEAD",
    "isLead": false,
    "assignmentType": "ALGORITHM" | "MANUAL",
    "teamMember": {...},
    "shift": {...}
  }
]
```

---

### POST `/api/assignments`
Run the assignment algorithm for an event.

**Request Body:**
```json
{
  "eventId": "string"
}
```

**Response:** `200 OK`
```json
{
  "assignments": [...],
  "scores": {...},
  "violations": [...],
  "explanations": {...}
}
```

**Errors:**
- `400` - Missing eventId
- `404` - Event not found

---

### POST `/api/assignments/swap`
Swap two assignments.

**Request Body:**
```json
{
  "assignmentId1": "string",
  "assignmentId2": "string"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "assignments": [...]
}
```

**Errors:**
- `400` - Invalid request (missing IDs, same assignment)
- `404` - Assignment not found

---

## Events

### GET `/api/events`
Get all events.

**Response:** `200 OK`
```json
[
  {
    "id": "string",
    "name": "string",
    "startDate": "2026-06-11T00:00:00.000Z",
    "endDate": "2026-07-08T00:00:00.000Z",
    "config": {...}
  }
]
```

---

## Audit Log

### GET `/api/audit`
Get audit log entries.

**Query Parameters:**
- `action` (optional) - Filter by action type
- `entityType` (optional) - Filter by entity type
- `startDate` (optional) - Filter by start date (ISO string)
- `endDate` (optional) - Filter by end date (ISO string)
- `search` (optional) - Text search
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 50)

**Response:** `200 OK`
```json
{
  "entries": [...],
  "total": 100,
  "page": 1,
  "limit": 50
}
```

---

## Health Check

### GET `/api/health`
Check application health.

**Response:** `200 OK`
```json
{
  "status": "ok" | "degraded" | "error",
  "timestamp": "2026-01-15T...",
  "version": "1.0.0",
  "checks": {
    "env": true,
    "database": true
  },
  "missingEnv": []
}
```

**Errors:**
- `503` - Service unavailable (in production mode if checks fail)

---

## Error Response Format

All errors follow a standardized format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": [...] // Optional, for validation errors
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Request validation failed (400)
- `UNAUTHORIZED` - Authentication required (401)
- `NOT_FOUND` - Resource not found (404)
- `CONFLICT` - Resource conflict (409)
- `INTERNAL_SERVER_ERROR` - Server error (500)

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All IDs are Prisma-generated strings
- Pagination uses 1-based page numbers
- Default page size is 50 items
- All endpoints require authentication except `/api/health`
