import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Search, X, Download, ChevronDown, ChevronUp } from "lucide-react";

const ACTION_COLORS = {
  login: "text-blue-700 bg-blue-50 border-blue-200",
  logout: "text-slate-700 bg-slate-100 border-slate-200",
  create: "text-emerald-700 bg-emerald-50 border-emerald-200",
  update: "text-amber-700 bg-amber-50 border-amber-200",
  delete: "text-red-700 bg-red-50 border-red-200",
  status_change: "text-purple-700 bg-purple-50 border-purple-200",
  reset_password: "text-orange-700 bg-orange-50 border-orange-200",
};

export default function AuditLog() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("ALL");
  const [expanded, setExpanded] = useState(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await api.get("/analytics/audit-log", { params: { limit: 500 } })).data,
  });

  const actions = useMemo(
    () => Array.from(new Set(data.map((r) => r.action).filter(Boolean))).sort(),
    [data]
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter((r) => {
      if (action !== "ALL" && r.action !== action) return false;
      if (!needle) return true;
      return (
        (r.user_name || "").toLowerCase().includes(needle) ||
        (r.user_email || "").toLowerCase().includes(needle) ||
        (r.action || "").toLowerCase().includes(needle) ||
        (r.target_type || "").toLowerCase().includes(needle) ||
        (r.target_id || "").toLowerCase().includes(needle) ||
        JSON.stringify(r.meta || {}).toLowerCase().includes(needle)
      );
    });
  }, [data, q, action]);

  function exportCsv() {
    const header = ["timestamp", "user", "email", "action", "target_type", "target_id", "details"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const cells = [
        r.ts || "", r.user_name || "", r.user_email || "", r.action || "",
        r.target_type || "", r.target_id || "",
        JSON.stringify(r.meta || {}).replace(/"/g, "'"),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "audit-log.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const hasFilter = q || action !== "ALL";

  return (
    <div className="space-y-5" data-testid="audit-log-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">Audit</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> Activity Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Semua aktivitas user tercatat untuk kepatuhan.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="audit-search"
              className="pl-8 w-56"
              placeholder="Cari user / target / detail…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-40" data-testid="audit-action-filter">
              <SelectValue placeholder="Semua aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua aksi</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="audit-export">
            <Download className="w-4 h-4 mr-1.5" /> CSV
          </Button>
        </div>
      </div>

      {hasFilter && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Menampilkan {rows.length} dari {data.length} entri</span>
          <button
            data-testid="audit-clear-filters"
            onClick={() => { setQ(""); setAction("ALL"); }}
            className="px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1 hover:bg-primary/20"
          >
            Reset filter <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left overline">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hasMeta = r.meta && Object.keys(r.meta).length > 0;
                const isOpen = expanded === r.id;
                return (
                  <tr
                    key={r.id}
                    className={`border-t border-border ${hasMeta ? "cursor-pointer hover:bg-muted/40" : ""}`}
                    data-testid={`audit-row-${r.id}`}
                    onClick={() => hasMeta && setExpanded(isOpen ? null : r.id)}
                  >
                    <td className="py-2 px-4 mono text-xs text-muted-foreground align-top">{r.ts?.slice(0, 19).replace("T", " ")}</td>
                    <td className="py-2 px-4 align-top">
                      <div className="font-medium">{r.user_name}</div>
                      <div className="text-xs text-muted-foreground">{r.user_email}</div>
                    </td>
                    <td className="py-2 px-4 align-top">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded border ${ACTION_COLORS[r.action] || "text-muted-foreground bg-muted border-border"}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="py-2 px-4 mono text-xs align-top">{r.target_type} · {r.target_id?.slice(0, 8)}…</td>
                    <td className="py-2 px-4 text-xs text-muted-foreground align-top">
                      {!hasMeta ? "—" : isOpen ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-primary mb-1">
                            Tutup <ChevronUp className="w-3 h-3" />
                          </span>
                          <pre className="bg-muted/50 rounded p-2 whitespace-pre-wrap break-all text-[11px]">
                            {JSON.stringify(r.meta, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-primary">
                          Lihat detail <ChevronDown className="w-3 h-3" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                  {isLoading ? "Memuat…" : hasFilter ? "Tidak ada hasil untuk filter ini." : "Belum ada aktivitas."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
