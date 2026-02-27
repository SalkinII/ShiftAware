"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { canRunAlgorithm } from "@/lib/services/event-status-permissions";
import type { EventStatus } from "@prisma/client";
import { unwrapApiResponse } from "@/lib/api-errors";

interface AttributeRule {
  id: string;
  shiftType: string;
  attribute: string;
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS";
  value: string;
}

interface DistributionConfig {
  fairnessWeight: number; // 0-100
  preferenceWeight: number; // 0-100
  maxShiftsPerPerson: number;
  minRestHours: number;
  attributeRules: AttributeRule[];
}

export function DistributionSettings() {
  const toast = useToast();
  const { selectedEventId, selectedEvent } = useEventContext(true);
  const [config, setConfig] = useState<DistributionConfig>({
    fairnessWeight: 50,
    preferenceWeight: 30,
    maxShiftsPerPerson: 12,
    minRestHours: 8,
    attributeRules: [],
  });

  const [showAddRule, setShowAddRule] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [attributeDefinitions, setAttributeDefinitions] = useState<
    Array<{
      id: string;
      name: string;
      label: string;
      type: string;
      options: string[];
    }>
  >([]);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);

  // Load config when event changes
  useEffect(() => {
    if (selectedEventId) {
      loadConfig();
      fetchAttributeDefinitions(selectedEventId);
    }
  }, [selectedEventId]);

  async function fetchAttributeDefinitions(eventId: string) {
    try {
      const [attrRes, tplRes] = await Promise.all([
        fetch(`/api/events/${eventId}/attributes`),
        fetch(`/api/events/${eventId}/templates`),
      ]);
      if (attrRes.ok) {
        const data = await attrRes.json();
        setAttributeDefinitions(data.data || []);
      }
      if (tplRes.ok) {
        const data = await tplRes.json();
        const tplData = data.data || {};
        const all = [
          ...(tplData.assigned || []),
          ...(tplData.eventSpecific || []),
        ];
        setTemplates(all);
      }
    } catch (error) {
      console.error("Failed to fetch attribute definitions:", error);
    }
  }

  async function loadConfig() {
    if (!selectedEventId) return;

    try {
      const res = await fetch(`/api/events/${selectedEventId}/config`);
      if (res.ok) {
        const data = await res.json();
        const cfg = unwrapApiResponse<any>(data);
        if (cfg) {
          setConfig({
            fairnessWeight: cfg.algorithmWeights?.fairness || 50,
            preferenceWeight: cfg.algorithmWeights?.preferences || 30,
            maxShiftsPerPerson: cfg.balanceThresholds?.maxShiftsPerPerson || 12,
            minRestHours: cfg.balanceThresholds?.minRestHours || 8,
            attributeRules: cfg.allocationRules || [],
          });
        }
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }

  const handleWeightChange = (
    key: "fairnessWeight" | "preferenceWeight",
    value: number,
  ) => {
    setConfig({ ...config, [key]: value });
  };

  const handleAddRule = () => {
    const newRule: AttributeRule = {
      id: Date.now().toString(),
      shiftType: templates[0]?.type || "",
      attribute: "experience_level",
      operator: "EQUALS",
      value: "",
    };
    setConfig({
      ...config,
      attributeRules: [...config.attributeRules, newRule],
    });
    setShowAddRule(false);
  };

  const handleDeleteRule = (id: string) => {
    setConfig({
      ...config,
      attributeRules: config.attributeRules.filter((rule) => rule.id !== id),
    });
  };

  const handleUpdateRule = (
    id: string,
    field: keyof AttributeRule,
    value: string,
  ) => {
    setConfig({
      ...config,
      attributeRules: config.attributeRules.map((rule) =>
        rule.id === id ? { ...rule, [field]: value } : rule,
      ),
    });
  };

  const handlePreview = async () => {
    if (!selectedEventId) {
      toast.error("Please select an event first");
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          preview: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const result = unwrapApiResponse<any>(data);
        const totalAssignments = result.assignments?.length || 0;
        const totalViolations = result.violations?.length || 0;
        toast.success(
          `Preview: ${totalAssignments} assignments proposed. ${totalViolations} constraint violations detected.`,
        );
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to preview");
      }
    } catch (error) {
      toast.error("Failed to preview algorithm results");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRunAlgorithm = async () => {
    if (!selectedEventId) return;
    if (!confirm("This will replace all current assignments. Continue?"))
      return;

    setRunning(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: selectedEventId }),
      });

      if (res.ok) {
        const data = await res.json();
        const result = unwrapApiResponse<any>(data);
        const count = result.assignments?.length || 0;
        toast.success(`${count} assignments created`);
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["assignments", "shifts"] },
          }),
        );
      } else {
        const error = await res.json();
        toast.error(error.message || "Algorithm failed");
      }
    } catch {
      toast.error("Algorithm failed");
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async () => {
    if (!selectedEventId) {
      toast.error("Please select an event first");
      return;
    }

    try {
      const res = await fetch(`/api/events/${selectedEventId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithmWeights: {
            fairness: config.fairnessWeight,
            preferences: config.preferenceWeight,
          },
          balanceThresholds: {
            maxShiftsPerPerson: config.maxShiftsPerPerson,
            minRestHours: config.minRestHours,
          },
          allocationRules: config.attributeRules,
        }),
      });

      if (res.ok) {
        toast.success("Distribution settings saved");
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  if (!selectedEventId) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please select an event from the header dropdown to configure allocation
        settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Distribution Logic
        </h3>
        <p className="text-sm text-gray-500">
          Configure how the algorithm assigns team members to shifts
        </p>
      </div>

      {/* Weights Section */}
      <Card className="p-6">
        <h4 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
          Algorithm Weights
          <Info className="w-4 h-4 text-gray-400" />
        </h4>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Fairness Weight
              </label>
              <span className="text-sm font-bold text-primary-600">
                {config.fairnessWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.fairnessWeight}
              onChange={(e) =>
                handleWeightChange("fairnessWeight", Number(e.target.value))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              How much to prioritize equal distribution of shifts among team
              members
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Preference Weight
              </label>
              <span className="text-sm font-bold text-primary-600">
                {config.preferenceWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.preferenceWeight}
              onChange={(e) =>
                handleWeightChange("preferenceWeight", Number(e.target.value))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              How much to prioritize team member preferences for specific shifts
            </p>
          </div>
        </div>
      </Card>

      {/* Constraints Section */}
      <Card className="p-6">
        <h4 className="text-md font-bold text-gray-900 mb-4">Constraints</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Shifts per Person
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={config.maxShiftsPerPerson}
              onChange={(e) =>
                setConfig({
                  ...config,
                  maxShiftsPerPerson: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Rest Hours
            </label>
            <input
              type="number"
              min="0"
              max="24"
              value={config.minRestHours}
              onChange={(e) =>
                setConfig({ ...config, minRestHours: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </Card>

      {/* Attribute Rules Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-bold text-gray-900">Attribute Rules</h4>
          <Button size="sm" onClick={handleAddRule}>
            <Plus className="w-4 h-4 mr-1" />
            Add Rule
          </Button>
        </div>

        <div className="space-y-3">
          {config.attributeRules.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No attribute rules defined. Click "Add Rule" to create one.
            </p>
          ) : (
            config.attributeRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <select
                    value={rule.shiftType}
                    onChange={(e) =>
                      handleUpdateRule(rule.id, "shiftType", e.target.value)
                    }
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {templates.length === 0 ? (
                      <option value="">No templates loaded</option>
                    ) : (
                      templates.map((t) => (
                        <option key={t.id} value={t.type}>
                          {t.name}
                        </option>
                      ))
                    )}
                  </select>

                  <select
                    value={rule.attribute}
                    onChange={(e) =>
                      handleUpdateRule(rule.id, "attribute", e.target.value)
                    }
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select attribute...</option>
                    {attributeDefinitions.map((attr) => (
                      <option key={attr.id} value={attr.name}>
                        {attr.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={rule.operator}
                    onChange={(e) =>
                      handleUpdateRule(
                        rule.id,
                        "operator",
                        e.target.value as AttributeRule["operator"],
                      )
                    }
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="EQUALS">Equals</option>
                    <option value="NOT_EQUALS">Not Equals</option>
                    <option value="CONTAINS">Contains</option>
                  </select>

                  {(() => {
                    const selectedAttr = attributeDefinitions.find(
                      (a) => a.name === rule.attribute,
                    );
                    if (selectedAttr?.type === "BOOLEAN") {
                      return (
                        <select
                          value={rule.value}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, "value", e.target.value)
                          }
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Select...</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      );
                    }
                    if (
                      selectedAttr &&
                      selectedAttr.options &&
                      selectedAttr.options.length > 0
                    ) {
                      return (
                        <select
                          value={rule.value}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, "value", e.target.value)
                          }
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Select value...</option>
                          {selectedAttr.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) =>
                          handleUpdateRule(rule.id, "value", e.target.value)
                        }
                        placeholder="Value..."
                        className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    );
                  })()}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  <Trash2 className="w-4 h-4 text-error-600" />
                </Button>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Example: "SUPER requires experience_level = Senior" ensures only
          senior members are assigned to SUPER shifts.
        </p>
      </Card>

      {/* Actions */}
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Button onClick={handleSave} variant="primary">
            Save Configuration
          </Button>
          {selectedEvent &&
            canRunAlgorithm(selectedEvent.status as EventStatus) && (
              <>
                <Button
                  variant="secondary"
                  onClick={handlePreview}
                  disabled={previewLoading}
                >
                  {previewLoading ? "Previewing..." : "Preview Assignment"}
                </Button>
                <Button
                  onClick={handleRunAlgorithm}
                  disabled={running}
                  className="shadow-lg"
                >
                  {running ? "Running..." : "Run Assignment"}
                </Button>
              </>
            )}
        </div>
        {selectedEvent &&
          !canRunAlgorithm(selectedEvent.status as EventStatus) && (
            <p className="text-sm text-gray-400 pt-4 border-t">
              Algorithm can only run when event status is &quot;Assigning&quot;.
              Current status:{" "}
              {selectedEvent.status.replace(/_/g, " ").toLowerCase()}
            </p>
          )}
      </div>
    </div>
  );
}
