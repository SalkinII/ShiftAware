# Member Directory Navigation & Inactive-Member Visibility Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two related gaps: (1) inactive members disappear from `/admin/team/manage` immediately after deactivation because the API hard-codes `isActive: true`, making the permanent-delete button unreachable; (2) the member management page is only reachable by direct URL — surface it as a "Member Directory" tab inside `/admin/team`.

**Architecture:** `GET /api/members` gains an `?includeInactive=true` flag that removes the hard-coded `isActive` filter. The content of `app/admin/team/manage/page.tsx` moves into a reusable `MemberManagement` component (with a new cache key `"members-all"` so it never collides with event-scoped member queries). The manage page becomes a thin wrapper; the `/admin/team` tab bar gains a "Member Directory" tab that renders the same component. The existing "Team Members" tab is renamed "Event Members" for clarity.

**Tech Stack:** Next.js 15 App Router · Prisma 5 · Vitest 4 · TypeScript · lucide-react · Tailwind v4

---

## File Map

| Action | File |
| --- | --- |
| Modify | `app/api/members/route.ts` |
| Create | `app/admin/team/components/MemberManagement.tsx` |
| Modify | `app/admin/team/manage/page.tsx` |
| Modify | `app/admin/team/page.tsx` |
| Modify | `app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx` |

---

## Task 1: Add `?includeInactive=true` to GET /api/members

**Files:**
- Modify: `app/api/members/route.ts`

- [ ] **Step 1.1: Update the GET handler to honour `includeInactive`**

In `app/api/members/route.ts`, replace the lines that build the `where` clause (the else-branch around lines 36-42):

```typescript
// OLD:
const where: any = { isActive: true };
if (search) {
  where.alias = { contains: search, mode: "insensitive" };
}
members = await service.listMembers(where);
```

Replace with:

```typescript
// NEW:
const includeInactive = searchParams.get("includeInactive") === "true";
const where: any = includeInactive ? {} : { isActive: true };
if (search) {
  where.alias = { contains: search, mode: "insensitive" };
}
members = await service.listMembers(where);
```

- [ ] **Step 1.2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.3: Commit**

```bash
git add app/api/members/route.ts
git commit -m "fix(api): add includeInactive query param to GET /api/members"
```

---

## Task 2: Extract MemberManagement component

**Files:**
- Create: `app/admin/team/components/MemberManagement.tsx`
- Modify: `app/admin/team/manage/page.tsx`

- [ ] **Step 2.1: Create MemberManagement.tsx**

Create `app/admin/team/components/MemberManagement.tsx` with the full content of the current manage page, with two changes:
- Cache key changes from `"members"` → `"members-all"`
- Fetch URL changes from `/api/members` → `/api/members?includeInactive=true`

```typescript
"use client";

import { useEffect, useState } from "react";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { Download, Search, UserCircle2, UserX, UserCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCache } from "@/lib/cache/useCache";
import { unwrapApiResponse } from "@/lib/api-errors";
import { ExperienceLevel, Role } from "@prisma/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";
import { AvailabilityHeatmap } from "@/components/features/AvailabilityHeatmap/AvailabilityHeatmap";
import { ProfileDetailCard } from "@/components/features/Identity/ProfileDetailCard";

interface TeamMember {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: ExperienceLevel;
  capabilities: Role[];
  isActive: boolean;
}

export function MemberManagement() {
  const toast = useToast();
  const [profileCardMember, setProfileCardMember] = useState<TeamMember | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "heatmap">("list");
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    memberId: string | null;
    memberName: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    memberId: null,
    memberName: "",
    isLoading: false,
  });
  const [permanentDeleteDialog, setPermanentDeleteDialog] = useState<{
    isOpen: boolean;
    memberId: string | null;
    memberName: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    memberId: null,
    memberName: "",
    isLoading: false,
  });

  const {
    data: members,
    loading,
    refetch: refetchMembers,
  } = useCache<TeamMember[]>({
    key: "members-all",
    fetchFn: async () => {
      const res = await fetch("/api/members?includeInactive=true");
      if (!res.ok) throw new Error("Failed to fetch members");
      const data = await res.json();
      return unwrapApiResponse<TeamMember[]>(data);
    },
  });

  useEffect(() => {
    const handleCacheInvalidate = (e: CustomEvent) => {
      const keys = e.detail?.keys || [];
      if (
        keys.some((k: string) => k === "members" || k.startsWith("members"))
      ) {
        refetchMembers();
      }
    };

    window.addEventListener(
      "shiftaware:cache-invalidate",
      handleCacheInvalidate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "shiftaware:cache-invalidate",
        handleCacheInvalidate as EventListener,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDeleteMember(memberId: string) {
    const member = members?.find((m) => m.id === memberId);
    if (!member) return;

    setDeleteDialog({
      isOpen: true,
      memberId,
      memberName: member.alias,
      isLoading: false,
    });
  }

  async function confirmDelete() {
    if (!deleteDialog.memberId) return;

    setDeleteDialog((prev) => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch(`/api/members/${deleteDialog.memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Member deactivated successfully");
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: {
              keys: [
                "members",
                "members*",
                "preferences",
                "preferences*",
                "assignments",
                "assignments*",
              ],
            },
          }),
        );
        setDeleteDialog({
          isOpen: false,
          memberId: null,
          memberName: "",
          isLoading: false,
        });
      } else {
        const errorData = await res.json();
        const errorMessage = errorData.error || "Failed to deactivate member";
        toast.error(errorMessage);
        setDeleteDialog((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Failed to deactivate member:", error);
      toast.error("Failed to deactivate member. Please try again.");
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }));
    }
  }

  async function handleReactivateMember(memberId: string) {
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      if (res.ok) {
        toast.success("Member reactivated successfully");
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["members", "members*"] },
          }),
        );
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to reactivate member");
      }
    } catch (error) {
      console.error("Failed to reactivate member:", error);
      toast.error("Failed to reactivate member. Please try again.");
    }
  }

  function handlePermanentDeleteMember(memberId: string) {
    const member = members?.find((m) => m.id === memberId);
    if (!member) return;

    setPermanentDeleteDialog({
      isOpen: true,
      memberId,
      memberName: member.alias,
      isLoading: false,
    });
  }

  async function confirmPermanentDelete() {
    if (!permanentDeleteDialog.memberId) return;

    setPermanentDeleteDialog((prev) => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch(
        `/api/members/${permanentDeleteDialog.memberId}/permanent`,
        { method: "DELETE" },
      );

      if (res.ok) {
        toast.success("Member permanently deleted");
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: {
              keys: [
                "members",
                "members*",
                "assignments",
                "assignments*",
                "preferences",
                "preferences*",
              ],
            },
          }),
        );
        setPermanentDeleteDialog({
          isOpen: false,
          memberId: null,
          memberName: "",
          isLoading: false,
        });
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to permanently delete member");
        setPermanentDeleteDialog((prev) => ({ ...prev, isLoading: false }));
      }
    } catch {
      toast.error("Failed to permanently delete member. Please try again.");
      setPermanentDeleteDialog((prev) => ({ ...prev, isLoading: false }));
    }
  }

  useKeyboardShortcuts([
    {
      key: "Escape",
      handler: () => {
        if (deleteDialog.isOpen && !deleteDialog.isLoading) {
          setDeleteDialog({
            isOpen: false,
            memberId: null,
            memberName: "",
            isLoading: false,
          });
        }
        if (permanentDeleteDialog.isOpen && !permanentDeleteDialog.isLoading) {
          setPermanentDeleteDialog({
            isOpen: false,
            memberId: null,
            memberName: "",
            isLoading: false,
          });
        }
      },
    },
  ]);

  async function loadMembers() {
    await refetchMembers();
  }

  function handleExportMapping() {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Pseudonym Conversion Table", 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("CONFIDENTIAL - FOR INTERNAL USE ONLY", 14, 28);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);

      const tableData = (members || []).map((m) => [
        m.avatarId,
        m.alias,
        "____________________",
      ]);

      autoTable(doc, {
        startY: 40,
        head: [["Avatar", "Alias (System Name)", "Real Name (Fill Manually)"]],
        body: tableData,
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 10, cellPadding: 5 },
      });

      doc.save("ShiftAware_Pseudonym_Mapping_Template.pdf");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to generate mapping template");
    } finally {
      setIsExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" variant="text" />
        <SkeletonList count={5} />
      </div>
    );
  }

  const filteredMembers = (members || []).filter((m) =>
    m.alias.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => {
          if (!deleteDialog.isLoading) {
            setDeleteDialog({
              isOpen: false,
              memberId: null,
              memberName: "",
              isLoading: false,
            });
          }
        }}
        onConfirm={confirmDelete}
        title="Deactivate Member"
        message={`Are you sure you want to deactivate "${deleteDialog.memberName}"? This will set them as inactive. Their preferences and assignments will be preserved, but they won't appear in active member lists. This action can be reversed.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteDialog.isLoading}
      />
      <ConfirmDialog
        isOpen={permanentDeleteDialog.isOpen}
        onClose={() => {
          if (!permanentDeleteDialog.isLoading) {
            setPermanentDeleteDialog({
              isOpen: false,
              memberId: null,
              memberName: "",
              isLoading: false,
            });
          }
        }}
        onConfirm={confirmPermanentDelete}
        title="Permanently Delete Member"
        message={`This will permanently delete "${permanentDeleteDialog.memberName}" and remove all their preferences, assignments, and event registrations. This cannot be undone.`}
        confirmText="Delete Permanently"
        cancelText="Cancel"
        variant="destructive"
        isLoading={permanentDeleteDialog.isLoading}
      />
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Team Members
            </h1>
            <p className="text-gray-500 font-medium">
              Manage and organize your event staff
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 rounded-xl p-1 flex">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all",
                  viewMode === "list"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("heatmap")}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all",
                  viewMode === "heatmap"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                Heatmap
              </button>
            </div>
            <Button
              variant="secondary"
              onClick={handleExportMapping}
              disabled={isExporting || !members || members.length === 0}
              className="flex items-center gap-2 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Generating..." : "Export Mapping"}
            </Button>
          </div>
        </div>

        {viewMode === "heatmap" ? (
          <AvailabilityHeatmap
            onCellClick={(memberId, shiftId, status) => {
              console.log("Cell clicked:", { memberId, shiftId, status });
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="shadow-sm p-2">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by alias..."
                    className="w-full pl-12 pr-4 py-3 bg-transparent focus:outline-none text-gray-900 font-medium placeholder:text-gray-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredMembers.map((member) => (
                  <Card
                    key={member.id}
                    className="shadow-sm hover:shadow-md transition-all p-6 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setProfileCardMember(member)}
                          className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl shadow-inner border border-gray-100 group-hover:scale-110 transition-transform cursor-pointer"
                          title={`View ${member.alias}'s profile`}
                        >
                          {member.avatarId}
                        </button>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 leading-tight">
                            {member.alias}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!member.isActive && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Inactive
                            </span>
                            <button
                              onClick={() => handleReactivateMember(member.id)}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                              aria-label={`Reactivate ${member.alias}`}
                              title="Reactivate member"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePermanentDeleteMember(member.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              aria-label={`Permanently delete ${member.alias}`}
                              title="Permanently delete member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {member.isActive && (
                          <button
                            onClick={() => handleDeleteMember(member.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            aria-label={`Deactivate ${member.alias}`}
                            title="Deactivate member"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white p-8 border-none shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
                  <UserCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black mb-2 leading-tight">
                  Privacy First Staffing
                </h3>
                <p className="text-sm text-primary-100 leading-relaxed opacity-90">
                  Team members use aliases to protect their real identities in
                  the system. Use the mapping template to keep local track of
                  real names.
                </p>
              </Card>

              <Card className="bg-white border-none shadow-sm p-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Quick Stats
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Total Records
                    </span>
                    <span className="text-sm font-black text-gray-900">
                      {members?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Active Duty
                    </span>
                    <span className="text-sm font-black text-success-600">
                      {(members || []).filter((m) => m.isActive).length}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      <ProfileDetailCard
        member={profileCardMember}
        onClose={() => setProfileCardMember(null)}
        editable
        onUpdate={loadMembers}
      />
    </>
  );
}
```

- [ ] **Step 2.2: Simplify manage/page.tsx to a thin wrapper**

Replace the entire content of `app/admin/team/manage/page.tsx` with:

```typescript
import { MemberManagement } from "../components/MemberManagement";

export default function MembersPage() {
  return <MemberManagement />;
}
```

- [ ] **Step 2.3: Run existing manage page tests**

```bash
npx vitest run app/admin/team/manage --reporter=verbose
```

Expected: all tests PASS (the mocks work at module level, the rendered output is identical).

- [ ] **Step 2.4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.5: Commit**

```bash
git add app/admin/team/components/MemberManagement.tsx \
        app/admin/team/manage/page.tsx
git commit -m "refactor(members): extract MemberManagement component, fix includeInactive fetch"
```

---

## Task 3: Add "Member Directory" tab to TeamPage and rename "Team Members" → "Event Members"

**Files:**
- Modify: `app/admin/team/page.tsx`
- Modify: `app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx`

- [ ] **Step 3.1: Write failing test for the new tab**

In `app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx`, add a mock for `MemberManagement` and add one describe block at the end:

```typescript
// Add to top of file alongside existing mocks:
vi.mock("../components/MemberManagement", () => ({
  MemberManagement: () => <div data-testid="member-management">Member Management</div>,
}));
```

Then add after the existing describe blocks:

```typescript
describe("TeamPage – Member Directory tab", () => {
  it("renders the Member Directory tab button", () => {
    render(<TeamPage />);
    expect(screen.getByText("Member Directory")).toBeInTheDocument();
  });

  it("shows MemberManagement when Member Directory tab is clicked", () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByText("Member Directory"));
    expect(screen.getByTestId("member-management")).toBeInTheDocument();
  });

  it("renames the event-scoped tab to Event Members", () => {
    render(<TeamPage />);
    expect(screen.getByText("Event Members")).toBeInTheDocument();
    expect(screen.queryByText("Team Members")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
npx vitest run app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx --reporter=verbose
```

Expected: FAIL — "Member Directory" and "Event Members" text not found, "Team Members" found unexpectedly.

- [ ] **Step 3.3: Update TeamPage to add the new tab**

Replace the entire content of `app/admin/team/page.tsx` with:

```typescript
"use client";

import { useState } from "react";
import { Activity, Users, UserCog, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { DistributionSettings } from "./components/DistributionSettings";
import { MemberListByEvent } from "./components/MemberListByEvent";
import { MemberManagement } from "./components/MemberManagement";
import { AvailabilityHeatmap } from "@/components/features/AvailabilityHeatmap/AvailabilityHeatmap";

type TabType = "directory" | "members" | "allocation" | "heatmap";

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<TabType>("directory");
  const { selectedEventId, selectedEvent } = useEventContext(true);

  const tabs = [
    { id: "directory" as TabType, label: "Member Directory", icon: UserCog },
    { id: "members" as TabType, label: "Event Members", icon: Users },
    {
      id: "allocation" as TabType,
      label: "Allocation & Distribution",
      icon: Zap,
    },
    { id: "heatmap" as TabType, label: "Availability Heatmap", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Team Management
        </h1>
        <p className="text-gray-500 font-medium">
          Manage team members and configure shift allocation settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 py-3 px-3 border-b-2 font-medium text-sm transition-colors min-h-[44px]",
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-6">
        {activeTab === "directory" && <MemberManagement />}

        {activeTab === "members" && (
          <Card className="p-6">
            {selectedEventId ? (
              <MemberListByEvent
                eventId={selectedEventId}
                eventName={selectedEvent?.name || ""}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">No event selected</p>
                <p className="text-sm mt-1">
                  Choose an event using the selector in the header (desktop) or
                  the menu sidebar (mobile).
                </p>
              </div>
            )}
          </Card>
        )}

        {activeTab === "allocation" && <DistributionSettings />}

        {activeTab === "heatmap" && (
          selectedEventId ? (
            <AvailabilityHeatmap eventId={selectedEventId} />
          ) : (
            <Card className="p-6">
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">No event selected</p>
                <p className="text-sm mt-1">
                  Choose an event using the selector in the header (desktop) or
                  the menu sidebar (mobile).
                </p>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
npx vitest run app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 3.5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3.6: Verify end-to-end in dev server**

Start the dev server (`npm run dev`) and navigate to `/admin/team`. Confirm:
1. Four tabs visible: "Member Directory", "Event Members", "Allocation & Distribution", "Availability Heatmap"
2. "Member Directory" tab is active by default and shows the full member list with ALL members (active and inactive)
3. Deactivating a member via `UserX` keeps them visible in the list with an "Inactive" badge and `UserCheck` + `Trash2` icons
4. The `Trash2` permanently-delete flow opens a confirm dialog and removes the member from the list
5. "Event Members" tab shows the event-scoped member list (requires event selection)
6. `/admin/team/manage` direct URL still works (renders the same component)

- [ ] **Step 3.7: Commit**

```bash
git add app/admin/team/page.tsx \
        app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx
git commit -m "feat(nav): add Member Directory tab to TeamPage, rename Event Members tab"
```

---

## Self-review checklist

- [x] Root cause 1 (disappearing card): `app/api/members/route.ts` now respects `?includeInactive=true`, and `MemberManagement` always fetches with that flag
- [x] Root cause 2 (unreachable page): "Member Directory" tab added as the default tab on `/admin/team`
- [x] Cache key isolation: `MemberManagement` uses key `"members-all"` to avoid serving inactive members to event-scoped consumers of the `"members"` cache key
- [x] Cache invalidation: the `"members*"` wildcard in all invalidation events covers both `"members"` and `"members-all"`
- [x] Backward compat: `/admin/team/manage` still works as a direct route (thin wrapper around same component)
- [x] No active-state highlight conflict in sidebar: `/admin/team/manage` is now accessed via tab, not a separate sidebar entry, so no double-highlight bug
- [x] Tests updated: new test for "Member Directory" tab, existing heatmap tests still pass, existing manage page tests still pass
- [x] Tab rename: "Team Members" → "Event Members" covered in test (checks absence of old label)
- [x] No placeholder steps: all code fully written out
- [x] Type consistency: `TabType` union in Task 3 includes `"directory"` matching all usages
