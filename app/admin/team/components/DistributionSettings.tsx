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
import { AlgorithmResultsModal } from "@/components/features/AlgorithmResultsModal";
import { getValidOperators, isBalanceModeAvailable } from "@/lib/algorithm/rule-compatibility";

interface AttributeRule {
  id: string;
  ruleKind?: "FILTER" | "BALANCE";
  shiftType: string;
  attribute: string;
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "ONE_OF";
  value: string;
  balanceMode?: "REQUIRE_ONE" | "REQUIRE_RATIO";
  minRatio?: number;
  maxRatio?: number;
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
    preferenceWeight: 50,
    maxShiftsPerPerson: 2,
    minRestHours: 6,
    attributeRules: [],
  });

  const [, setShowAddRule] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);
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
    if (!selectedEventId) return;
    const ac = new AbortController();
    const signal = ac.signal;

    (async () => {
      try {
        const [attrRes, tplRes] = await Promise.all([
          fetch(`/api/events/${selectedEventId}/attributes`, { signal }),
          fetch(`/api/events/${selectedEventId}/templates`, { signal }),
        ]);
        if (signal.aborted) return;
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

        const cfgRes = await fetch(`/api/events/${selectedEventId}/config`, { signal });
        if (signal.aborted) return;
        if (cfgRes.ok) {
          const data = await cfgRes.json();
          const cfg = unwrapApiResponse<any>(data);
          if (signal.aborted) return;
          if (cfg) {
            const weights = cfg.algorithmWeights || {};
            let fairness = weights._uiFairness ?? 50;
            let preferences = weights._uiPreferences ?? 30;
            if (weights._uiFairness === undefined && weights.preferenceMatch !== undefined) {
              const wb = weights.workloadFairness || 0;
              const pm = weights.preferenceMatch || 0;
              const total = wb + pm;
              fairness = total > 0 ? Math.round((wb / total) * 100) : 50;
              preferences = total > 0 ? Math.round((pm / total) * 100) : 30;
            }
            setConfig({
              fairnessWeight: fairness,
              preferenceWeight: preferences,
              maxShiftsPerPerson: cfg.balanceThresholds?.maxShiftsPerPerson || 12,
              minRestHours: cfg.balanceThresholds?.minRestHours || 8,
              attributeRules: (cfg.allocationRules || []).map((r: AttributeRule) => ({
                ...r,
                ruleKind: r.ruleKind || "FILTER",
              })),
            });
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to fetch attribute definitions:", error);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [selectedEventId]);

  async function loadConfig() {
    if (!selectedEventId) return;

    try {
      const res = await fetch(`/api/events/${selectedEventId}/config`);
      if (res.ok) {
        const data = await res.json();
        const cfg = unwrapApiResponse<any>(data);
        if (cfg) {
          // Reverse-map: check for preserved UI values first, fallback to derivation
          const weights = cfg.algorithmWeights || {};
          let fairness = weights._uiFairness ?? 50;
          let preferences = weights._uiPreferences ?? 30;

          // If no UI values stored, derive from 4-factor weights
          if (weights._uiFairness === undefined && weights.preferenceMatch !== undefined) {
            const wb = weights.workloadFairness || 0;
            const pm = weights.preferenceMatch || 0;
            const total = wb + pm;
            fairness = total > 0 ? Math.round((wb / total) * 100) : 50;
            preferences = total > 0 ? Math.round((pm / total) * 100) : 30;
          }

          setConfig({
            fairnessWeight: fairness,
            preferenceWeight: preferences,
            maxShiftsPerPerson: cfg.balanceThresholds?.maxShiftsPerPerson || 12,
            minRestHours: cfg.balanceThresholds?.minRestHours || 8,
            attributeRules: (cfg.allocationRules || []).map((r: AttributeRule) => ({
              ...r,
              ruleKind: r.ruleKind || "FILTER",
            })),
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
    setPreviewResult(null);
    setConfig({ ...config, [key]: value });
  };

  const handleAddRule = () => {
    const newRule: AttributeRule = {
      id: Date.now().toString(),
      ruleKind: "FILTER",
      shiftType: templates[0]?.id || "",
      attribute: "",
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
    value: string | number,
  ) => {
    setConfig({
      ...config,
      attributeRules: config.attributeRules.map((rule) => {
        if (rule.id !== id) return rule;
        if (field === "minRatio" || field === "maxRatio") {
          return { ...rule, [field]: typeof value === "number" ? value : parseFloat(value) };
        }
        return { ...rule, [field]: value };
      }),
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
        setPreviewResult(result);
        // Do NOT call loadConfig() after preview — preserves user's slider values (#14)
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to preview");
      }
    } catch {
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
        // Reload config to reflect any changes
        await loadConfig();
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
      // Map UI sliders to 2-factor weights
      const total = config.fairnessWeight + config.preferenceWeight;
      const fairnessNorm = config.fairnessWeight / total;
      const prefNorm = config.preferenceWeight / total;

      const res = await fetch(`/api/events/${selectedEventId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithmWeights: {
            preferenceMatch: Math.round(prefNorm * 100) / 100,
            workloadFairness: Math.round(fairnessNorm * 100) / 100,
            _uiFairness: config.fairnessWeight,
            _uiPreferences: config.preferenceWeight,
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
    } catch {
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
            config.attributeRules.map((rule) => {
              const selectedAttr = attributeDefinitions.find(
                (a) => a.name === rule.attribute,
              );
              const attrType = selectedAttr?.type || "TEXT";
              const canBalance = isBalanceModeAvailable(attrType);
              const validOperators = getValidOperators(
                attrType,
                rule.ruleKind || "FILTER",
              );

              return (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
                >
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="grid grid-cols-5 gap-2">
                      <select
                        value={rule.ruleKind || "FILTER"}
                        onChange={(e) => {
                          const newKind = e.target.value as "FILTER" | "BALANCE";
                          const updates: Partial<AttributeRule> = { ruleKind: newKind };
                          if (newKind === "FILTER") {
                            updates.balanceMode = undefined;
                          }
                          const newValidOps = getValidOperators(attrType, newKind);
                          if (!newValidOps.includes(rule.operator)) {
                            updates.operator = (newValidOps[0] || "EQUALS") as AttributeRule["operator"];
                          }
                          setConfig({
                            ...config,
                            attributeRules: config.attributeRules.map((r) =>
                              r.id === rule.id ? { ...r, ...updates } : r,
                            ),
                          });
                        }}
                        className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="FILTER">Filter</option>
                        {canBalance && <option value="BALANCE">Balance</option>}
                      </select>

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
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))
                        )}
                      </select>

                      <select
                        value={rule.attribute}
                        onChange={(e) => {
                          const newAttrName = e.target.value;
                          const newAttr = attributeDefinitions.find(
                            (a) => a.name === newAttrName,
                          );
                          const newType = newAttr?.type || "TEXT";
                          const newKind = rule.ruleKind || "FILTER";
                          const updates: Partial<AttributeRule> = { attribute: newAttrName };
                          if (newKind === "BALANCE" && !isBalanceModeAvailable(newType)) {
                            updates.ruleKind = "FILTER";
                            updates.balanceMode = undefined;
                          }
                          const ops = getValidOperators(newType, updates.ruleKind || newKind);
                          if (!ops.includes(rule.operator)) {
                            updates.operator = (ops[0] || "EQUALS") as AttributeRule["operator"];
                          }
                          setConfig({
                            ...config,
                            attributeRules: config.attributeRules.map((r) =>
                              r.id === rule.id ? { ...r, ...updates } : r,
                            ),
                          });
                        }}
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
                        value={validOperators.includes(rule.operator) ? rule.operator : validOperators[0] || ""}
                        onChange={(e) =>
                          handleUpdateRule(
                            rule.id,
                            "operator",
                            e.target.value as AttributeRule["operator"],
                          )
                        }
                        className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {validOperators.map((op) => (
                          <option key={op} value={op}>
                            {op === "EQUALS"
                              ? "Equals"
                              : op === "NOT_EQUALS"
                                ? "Not Equals"
                                : op === "CONTAINS"
                                  ? "Contains"
                                  : "One Of"}
                          </option>
                        ))}
                      </select>

                      {(() => {
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
                        if (rule.operator === "ONE_OF") {
                          return (
                            <input
                              type="text"
                              value={rule.value}
                              onChange={(e) =>
                                handleUpdateRule(rule.id, "value", e.target.value)
                              }
                              placeholder="e.g. FINTA, M (comma-separated)"
                              className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 flex-1 min-w-0"
                            />
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

                    {(rule.ruleKind || "FILTER") === "BALANCE" && (
                      <div className="flex items-center gap-3">
                        <select
                          value={rule.balanceMode || "REQUIRE_ONE"}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, "balanceMode", e.target.value)
                          }
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="REQUIRE_ONE">Require One</option>
                          <option value="REQUIRE_RATIO">Require Ratio</option>
                        </select>
                        {rule.balanceMode === "REQUIRE_RATIO" && (
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Math.round((rule.minRatio ?? 0) * 100)}
                              onChange={(e) =>
                                handleUpdateRule(
                                  rule.id,
                                  "minRatio",
                                  Number(e.target.value) / 100,
                                )
                              }
                              placeholder="Min %"
                              className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-500">–</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Math.round((rule.maxRatio ?? 1) * 100)}
                              onChange={(e) =>
                                handleUpdateRule(
                                  rule.id,
                                  "maxRatio",
                                  Number(e.target.value) / 100,
                                )
                              }
                              placeholder="Max %"
                              className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-500">% ratio</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    <Trash2 className="w-4 h-4 text-error-600" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <p className="text-xs text-gray-500 mt-3">
          <strong>Filter</strong> rules gate individual candidates (e.g., &quot;Driver requires can_drive = YES&quot;).{" "}
          <strong>Balance</strong> rules enforce shift composition (e.g., &quot;At least one FINTA member per shift&quot;).
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

      {previewResult && (
        <AlgorithmResultsModal
          result={previewResult}
          onClose={() => setPreviewResult(null)}
          eventId={selectedEventId ?? undefined}
        />
      )}
    </div>
  );
}
