import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

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
  const { data = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await api.get("/analytics/audit-log", { params: { limit: 200 } })).data,
  });

  return (
    <div className="space-y-5" data-testid="audit-log-page">
      <div>
        <div className="overline">Audit</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> Activity Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Semua aktivitas user tercatat untuk kepatuhan.</p>
      </div>
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
              {data.map((r) => (
                <tr key={r.id} className="border-t border-border" data-testid={`audit-row-${r.id}`}>
                  <td className="py-2 px-4 mono text-xs text-muted-foreground">{r.ts?.slice(0, 19).replace("T", " ")}</td>
                  <td className="py-2 px-4">
                    <div className="font-medium">{r.user_name}</div>
                    <div className="text-xs text-muted-foreground">{r.user_email}</div>
                  </td>
                  <td className="py-2 px-4">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${ACTION_COLORS[r.action] || "text-muted-foreground bg-muted border-border"}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="py-2 px-4 mono text-xs">{r.target_type} · {r.target_id?.slice(0, 8)}…</td>
                  <td className="py-2 px-4 text-xs text-muted-foreground">
                    {r.meta && Object.keys(r.meta).length ? JSON.stringify(r.meta) : "—"}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Belum ada aktivitas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
