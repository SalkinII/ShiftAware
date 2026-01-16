# ShiftAware Admin Guide

## Overview

ShiftAware is a privacy-first shift management system designed for event staffing. This guide covers administrative tasks and workflows.

## Getting Started

### Login
1. Navigate to the application URL
2. Enter the `ADMIN_PASSWORD` configured in environment variables
3. You'll be redirected to the dashboard upon successful authentication

### Navigation
- **Dashboard**: Overview of events and quick actions
- **My Preferences**: Enter shift preferences (if acting as team member)
- **Schedule View**: View all shifts in Day/Week/Grid formats
- **Coverage Gaps**: Identify unstaffed or partially staffed shifts
- **Team Members**: Manage team member profiles
- **Shift Config**: Create and manage shifts
- **Audit Log**: View system change history

## Core Workflows

### 1. Setting Up an Event

1. **Create Team Members** (`/admin/members`)
   - Add team members with aliases and avatars
   - Set experience levels and capabilities
   - Configure gender roles for balance constraints

2. **Configure Shifts** (`/admin/shifts`)
   - Create shifts with start/end times
   - Set capacity and required roles
   - Mark core vs buffer shifts
   - Set desirability scores

3. **Collect Preferences** (`/preferences`)
   - Team members select preferred shifts
   - Minimum 2 shifts required per person
   - Preferences are ranked by priority

### 2. Running Assignments

1. Navigate to **Dashboard**
2. Select the event
3. Click **"Run Assignment Engine"**
4. Review results:
   - Coverage statistics
   - Assignment details
   - Algorithm scores and rationale

### 3. Manual Adjustments

**Swap Assignments** (`/schedule`)
1. View schedule and identify shifts to swap
2. Click on shift assignments to view details
3. Use swap API endpoint (programmatic) or UI (if implemented)

**Coverage Gaps** (`/admin/coverage`)
1. View unstaffed and partially staffed shifts
2. Review quick-fill recommendations
3. Manually assign members to fill gaps

### 4. Exporting Schedules

**PDF Export** (`/schedule`)
1. Set export options:
   - Scope: Full schedule or member-specific
   - Orientation: Landscape or Portrait
   - Include pseudonym mapping: Yes/No
2. Click **"Export PDF"**
3. Download generated PDF

**Audit Log Export** (`/admin/audit`)
1. Filter logs as needed
2. Click **"Export CSV"**
3. Download CSV file

## Key Concepts

### Shift Types
- **MOBILE_TEAM_1/2**: Mobile teams requiring 2 people each
- **STATIONARY**: Stationary team with shift lead
- **EXECUTIVE**: Executive shifts (8-12 hours)

### Coverage States
- **Fully Staffed**: All positions filled
- **Partially Staffed**: Some positions filled
- **Unstaffed**: No assignments

### Assignment Types
- **ALGORITHM**: Assigned by algorithm
- **MANUAL**: Manually assigned by admin
- **SWAP**: Result of manual swap
- **RANDOM**: Fallback assignment

## Best Practices

1. **Before Running Algorithm**
   - Ensure all team members have submitted preferences
   - Verify shift configurations are complete
   - Check that core shifts are properly marked

2. **After Algorithm Run**
   - Review coverage gaps
   - Check for constraint violations
   - Use quick-fill recommendations for remaining gaps

3. **Audit Trail**
   - All changes are logged automatically
   - Review audit log regularly for accountability
   - Export logs for compliance if needed

4. **Privacy**
   - Pseudonyms protect team member identities
   - Pseudonym mapping should be handled securely
   - Delete mapping tables after event completion

## Troubleshooting

### Algorithm produces poor assignments
- Check that preferences are submitted
- Verify shift capacity matches requirements
- Review constraint violations in algorithm output

### Coverage gaps persist
- Use quick-fill recommendations
- Check member availability and preferences
- Consider adjusting shift times or capacity

### Export fails
- Verify shifts have assignments
- Check browser console for errors
- Ensure sufficient memory for large exports

## Security Notes

- `ADMIN_PASSWORD` should be strong and unique
- Session timeout is configurable (default 60 minutes)
- All actions are logged in audit trail
- Pseudonym mapping should be stored securely offline
