"use client";

import { useEffect, useState } from "react";
import {
  useKeyboardShortcuts,
  commonShortcuts,
} from "@/lib/hooks/useKeyboardShortcuts";
import {
  Plus,
  Download,
  Search,
  UserCircle2,
  Shield,
  UserX,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCache } from "@/lib/cache/useCache";
import { ExperienceLevel, Role } from "@prisma/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";
import { AvailabilityHeatmap } from "@/components/features/AvailabilityHeatmap/AvailabilityHeatmap";

interface TeamMember {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: ExperienceLevel;
  genderRole: string;
  capabilities: Role[];
  isActive: boolean;
}

export default function MembersPage() {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    alias: "",
    avatarId: "🐺",
    experienceLevel: "INTERMEDIATE" as ExperienceLevel,
    genderRole: "",
    capabilities: [] as Role[],
  });

  // Use cache for members
  const {
    data: members,
    loading,
    refetch: refetchMembers,
  } = useCache<TeamMember[]>({
    key: "members",
    fetchFn: async () => {
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  // Listen for cache invalidation events
  useEffect(() => {
    const handleCacheInvalidate = (e: CustomEvent) => {
      const keys = e.detail?.keys || [];
      // Only refetch if members cache is affected
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
  }, []); // Empty deps - refetch function is stable from useCache

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
        // Invalidate cache
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
        const errorMessage = errorData.error || "Failed to delete member";
        toast.error(errorMessage);
        setDeleteDialog((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Failed to delete member:", error);
      toast.error("Failed to delete member. Please try again.");
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

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "Escape",
      handler: () => {
        if (showForm) {
          setShowForm(false);
          setFormErrors({});
        }
        if (deleteDialog.isOpen && !deleteDialog.isLoading) {
          setDeleteDialog({
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

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!formData.alias.trim()) {
      errors.alias = "Alias is required";
    }

    if (!formData.genderRole) {
      errors.genderRole = "Gender role is required";
    }

    if (formData.capabilities.length === 0) {
      errors.capabilities = "At least one capability is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the form errors before submitting");
      return;
    }

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success("Member created successfully");
        // Invalidate cache for members
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["members", "members*"] },
          }),
        );
        await loadMembers();
        setShowForm(false);
        setFormErrors({});
        setFormData({
          alias: "",
          avatarId: "🐺",
          experienceLevel: "INTERMEDIATE",
          genderRole: "",
          capabilities: [],
        });
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create member");
      }
    } catch (error) {
      console.error("Failed to create member:", error);
      toast.error("Failed to create member. Please try again.");
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

  const getExpBadgeColor = (level: ExperienceLevel) => {
    switch (level) {
      case "SENIOR":
        return "bg-primary-100 text-primary-700";
      case "INTERMEDIATE":
        return "bg-accent-50 text-accent-700";
      case "JUNIOR":
        return "bg-success-50 text-success-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

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
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900",
                )}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("heatmap")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  viewMode === "heatmap"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900",
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
            <Button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 shadow-lg shadow-primary-500/20"
            >
              {showForm ? (
                "Cancel"
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add Member
                </>
              )}
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
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl shadow-inner border border-gray-100 group-hover:scale-110 transition-transform">
                          {member.avatarId}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 leading-tight">
                            {member.alias}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={cn(
                                "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                                getExpBadgeColor(member.experienceLevel),
                              )}
                            >
                              {member.experienceLevel}
                            </span>
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-tighter">
                              • {member.genderRole}
                            </span>
                          </div>
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

                    <div className="mt-6 pt-4 border-t border-gray-50">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-primary-400" />{" "}
                        Capabilities
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {member.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="text-[10px] font-bold bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-100"
                          >
                            {cap.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {showForm ? (
                <Card className="bg-white border-none shadow-xl p-8 animate-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary-500" /> New Member
                  </h2>
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                    aria-label="Add new team member form"
                  >
                    <Input
                      label="System Alias"
                      placeholder="e.g. Wolf, Fox, Bear"
                      value={formData.alias}
                      onChange={(e) => {
                        setFormData({ ...formData, alias: e.target.value });
                        if (formErrors.alias) {
                          setFormErrors({ ...formErrors, alias: "" });
                        }
                      }}
                      error={formErrors.alias}
                      required
                      className="bg-gray-50 border-gray-100 font-medium"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Avatar Emoji"
                        value={formData.avatarId}
                        onChange={(e) =>
                          setFormData({ ...formData, avatarId: e.target.value })
                        }
                        required
                        className="bg-gray-50 border-gray-100 text-center text-xl"
                      />
                      <Select
                        label="Exp Level"
                        value={formData.experienceLevel}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            experienceLevel: e.target.value as ExperienceLevel,
                          })
                        }
                        className="bg-gray-50 border-gray-100 font-medium"
                      >
                        <option value="JUNIOR">Junior</option>
                        <option value="INTERMEDIATE">Intermediate</option>
                        <option value="SENIOR">Senior</option>
                      </Select>
                    </div>
                    <Input
                      label="Gender Role"
                      placeholder="e.g. Male, Female, Non-binary"
                      value={formData.genderRole}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          genderRole: e.target.value,
                        });
                        if (formErrors.genderRole) {
                          setFormErrors({ ...formErrors, genderRole: "" });
                        }
                      }}
                      error={formErrors.genderRole}
                      required
                      className="bg-gray-50 border-gray-100 font-medium"
                    />
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                        Capabilities
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      {formErrors.capabilities && (
                        <p
                          className="text-sm text-red-600 font-medium flex items-center gap-1"
                          role="alert"
                        >
                          <span>⚠</span>
                          {formErrors.capabilities}
                        </p>
                      )}
                      <div className="grid grid-cols-1 gap-2 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        {Object.values(Role).map((role) => (
                          <label
                            key={role}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                checked={formData.capabilities.includes(role)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      capabilities: [
                                        ...formData.capabilities,
                                        role,
                                      ],
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      capabilities:
                                        formData.capabilities.filter(
                                          (r) => r !== role,
                                        ),
                                    });
                                  }
                                  if (formErrors.capabilities) {
                                    setFormErrors({
                                      ...formErrors,
                                      capabilities: "",
                                    });
                                  }
                                }}
                                className="w-5 h-5 rounded-lg border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                              {role.replace("_", " ")}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full py-4 shadow-lg shadow-primary-500/20 font-bold uppercase tracking-widest text-xs"
                    >
                      Create Member Record
                    </Button>
                  </form>
                </Card>
              ) : (
                <div className="space-y-6">
                  <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white p-8 border-none shadow-xl">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
                      <UserCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-black mb-2 leading-tight">
                      Privacy First Staffing
                    </h3>
                    <p className="text-sm text-primary-100 leading-relaxed opacity-90">
                      Team members use aliases to protect their real identities
                      in the system. Use the mapping template to keep local
                      track of real names.
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
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">
                          Senior Staff
                        </span>
                        <span className="text-sm font-black text-primary-600">
                          {
                            (members || []).filter(
                              (m) => m.experienceLevel === "SENIOR",
                            ).length
                          }
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
