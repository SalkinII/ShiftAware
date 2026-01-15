"use client";

import { useEffect, useState } from "react";
import { Plus, Download, Search, UserCircle2, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ExperienceLevel, Role } from "@prisma/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";

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
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    alias: "",
    avatarId: "🐺",
    experienceLevel: "INTERMEDIATE" as ExperienceLevel,
    genderRole: "",
    capabilities: [] as Role[],
  });

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const res = await fetch("/api/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Failed to load members:", error);
    } finally {
      setLoading(false);
    }
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

      const tableData = members.map((m) => [
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
      alert("Failed to generate mapping template");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await loadMembers();
        setShowForm(false);
        setFormData({
          alias: "",
          avatarId: "🐺",
          experienceLevel: "INTERMEDIATE",
          genderRole: "",
          capabilities: [],
        });
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create member");
      }
    } catch (error) {
      console.error("Failed to create member:", error);
      alert("Failed to create member");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const filteredMembers = members.filter((m) =>
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
          <Button
            variant="secondary"
            onClick={handleExportMapping}
            disabled={isExporting || members.length === 0}
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
                  {!member.isActive && (
                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-primary-400" /> Capabilities
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
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="System Alias"
                  placeholder="e.g. Wolf, Fox, Bear"
                  value={formData.alias}
                  onChange={(e) =>
                    setFormData({ ...formData, alias: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, genderRole: e.target.value })
                  }
                  required
                  className="bg-gray-50 border-gray-100 font-medium"
                />
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                    Capabilities
                  </label>
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
                                  capabilities: formData.capabilities.filter(
                                    (r) => r !== role,
                                  ),
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
                      {members.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Active Duty
                    </span>
                    <span className="text-sm font-black text-success-600">
                      {members.filter((m) => m.isActive).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Senior Staff
                    </span>
                    <span className="text-sm font-black text-primary-600">
                      {
                        members.filter((m) => m.experienceLevel === "SENIOR")
                          .length
                      }
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
