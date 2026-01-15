"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import { Download, Search, RefreshCw } from "lucide-react";
import { AuditAction, EntityType } from "@prisma/client";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  userId: string | null;
  user: { id: string; alias: string; avatarId: string } | null;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  before: any;
  after: any;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Filters
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, entityTypeFilter, startDate, endDate]);

  async function loadLogs(reset = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.append("action", actionFilter);
      if (entityTypeFilter !== "all")
        params.append("entityType", entityTypeFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("limit", limit.toString());
      params.append("offset", reset ? "0" : offset.toString());

      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (reset) {
          setLogs(data.logs);
          setOffset(0);
        } else {
          setLogs((prev) => [...prev, ...data.logs]);
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error("Failed to load audit logs:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleLoadMore() {
    setOffset((prev) => prev + limit);
    loadLogs(false);
  }

  function handleReset() {
    setActionFilter("all");
    setEntityTypeFilter("all");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setOffset(0);
    loadLogs(true);
  }

  function handleExportCSV() {
    const headers = [
      "Timestamp",
      "Action",
      "Entity Type",
      "Entity ID",
      "User",
      "Reason",
      "IP Address",
    ];
    const rows = filteredLogs.map((log) => [
      format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss"),
      log.action,
      log.entityType,
      log.entityId,
      log.user?.alias || "System",
      log.reason || "",
      log.ipAddress || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (log) =>
          log.action.toLowerCase().includes(query) ||
          log.entityType.toLowerCase().includes(query) ||
          log.entityId.toLowerCase().includes(query) ||
          log.user?.alias.toLowerCase().includes(query) ||
          log.reason?.toLowerCase().includes(query),
      );
    }
    return result;
  }, [logs, searchQuery]);

  const actionColors: Partial<Record<AuditAction, string>> = {
    CREATE: "bg-success-50 text-success-700 border-success-200",
    UPDATE: "bg-accent-50 text-accent-700 border-accent-200",
    DELETE: "bg-red-50 text-red-700 border-red-200",
    MANUAL_SWAP: "bg-primary-50 text-primary-700 border-primary-200",
    ASSIGNMENT_RUN: "bg-violet-50 text-violet-700 border-violet-200",
    PREFERENCE_SUBMIT: "bg-blue-50 text-blue-700 border-blue-200",
    EXPORT: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Audit Log
          </h1>
          <p className="text-gray-500 font-medium">
            Track all system changes and actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            variant="primary"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-white border border-gray-200 shadow-sm rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) =>
                setActionFilter(e.target.value as AuditAction | "all")
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
            >
              <option value="all">All Actions</option>
              {Object.values(AuditAction).map((action) => (
                <option key={action} value={action}>
                  {action.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500">
              Entity Type
            </label>
            <select
              value={entityTypeFilter}
              onChange={(e) =>
                setEntityTypeFilter(e.target.value as EntityType | "all")
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
            >
              <option value="all">All Types</option>
              {Object.values(EntityType).map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500">
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 font-medium">
          Showing {filteredLogs.length} of {total} logs
        </p>
      </div>

      <div className="space-y-3">
        {loading && filteredLogs.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
          </Card>
        ) : filteredLogs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No audit logs found</p>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card
              key={log.id}
              className="p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest border",
                        actionColors[log.action] ||
                          "bg-gray-50 text-gray-700 border-gray-200",
                      )}
                    >
                      {log.action.replace("_", " ")}
                    </span>
                    <span className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100">
                      {log.entityType.replace("_", " ")}
                    </span>
                    {log.user && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{log.user.avatarId}</span>
                        <span className="text-sm font-semibold text-gray-700">
                          {log.user.alias}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-semibold">Entity ID:</span>{" "}
                    {log.entityId}
                  </p>
                  {log.reason && (
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-semibold">Reason:</span>{" "}
                      {log.reason}
                    </p>
                  )}
                  {log.before && log.after && (
                    <details className="mt-2">
                      <summary className="text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700">
                        View Changes
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="font-bold text-red-600 mb-1">Before:</p>
                          <pre className="bg-red-50 p-2 rounded border border-red-200 overflow-auto">
                            {JSON.stringify(log.before, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="font-bold text-success-600 mb-1">
                            After:
                          </p>
                          <pre className="bg-success-50 p-2 rounded border border-success-200 overflow-auto">
                            {JSON.stringify(log.after, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p className="font-semibold">
                    {format(new Date(log.createdAt), "MMM d, yyyy")}
                  </p>
                  <p>{format(new Date(log.createdAt), "HH:mm:ss")}</p>
                  {log.ipAddress && (
                    <p className="mt-1 text-[10px]">IP: {log.ipAddress}</p>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={handleLoadMore}
            disabled={loading}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
