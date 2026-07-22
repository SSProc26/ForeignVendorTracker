import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiError } from "@/lib/api";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { statusMeta, allowedTransitions } from "@/lib/constants";
import { Search, ChevronRight, Loader2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

export default function Queue() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("updated");
  const [sortDir, setSortDir] = useState("desc");
  const [movingId, setMovingId] = useState(null);

  // Every status that requires action from this role. Reviewers must also see items
  // returned to them and items awaiting clarification; approvers must see the
  // post-approval MySSC stages, not just PENDING_APPROVAL.
  const targetStatuses =
    user.role === "approver"
      ? ["PENDING_APPROVAL", "APPROVED", "MYSSC_REQUESTED"]
      : user.role === "admin"
        ? ["IN_REVIEW", "CLARIFICATION", "RETURNED", "PENDING_APPROVAL", "APPROVED", "MYSSC_REQUESTED"]
        : ["IN_REVIEW", "CLARIFICATION", "RETURNED"];

  const { data = [], isLoading } = useQuery({
    queryKey: ["queue", targetStatuses.join(",")],
    queryFn: async () => {
      const all = (await api.get("/vendors")).data || [];
      return all.filter((v) => targetStatuses.includes(v.status));
    },
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }) =>
      (await api.post(`/vendors/${id}/status`, { status, note: "Diubah dari Antrian" })).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["analytics-summary"] });
      toast.success(`Status → ${statusMeta(vars.status).label}`);
      setMovingId(null);
    },
    onError: (e) => {
      toast.error(formatApiError(e.response?.data?.detail));
      setMovingId(null);
    },
  });

  function toggleSort(col) {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = data.filter((v) =>
      !needle ||
      (v.name || "").toLowerCase().includes(needle) ||
      (v.country || "").toLowerCase().includes(needle) ||
      (v.handler || "").toLowerCase().includes(needle)
    );
    const key = { name: "name", country: "country", status: "status", handler: "handler", updated: "updated_at" }[sortBy] || "updated_at";
    out.sort((a, b) => {
      const av = (a[key] || "").toString().toLowerCase();
      const bv = (b[key] || "").toString().toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [data, q, sortBy, sortDir]);

  const Th = ({ col, children }) => (
    <th className="py-3 px-4">
      <button
        onClick={() => toggleSort(col)}
        data-testid={`queue-sort-${col}`}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortBy === col ? "text-primary" : "opacity-40"}`} />
      </button>
    </th>
  );

  return (
    <div className="space-y-4" data-testid="queue-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">Action Required</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Antrian Saya</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vendor yang menunggu tindakan Anda ({targetStatuses.map((s) => statusMeta(s).label).join(", ")}).
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="queue-search"
            className="pl-8 w-60"
            placeholder="Cari vendor / handler…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left overline">
                <Th col="name">Vendor</Th>
                <Th col="country">Country</Th>
                <Th col="status">Status</Th>
                <Th col="handler">Handler</Th>
                <Th col="updated">Updated</Th>
                <th className="py-3 px-4">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const next = allowedTransitions(v.status, user.role);
                const busy = movingId === v.id;
                return (
                  <tr key={v.id} className="border-t border-border hover:bg-muted/40" data-testid={`queue-row-${v.id}`}>
                    <td className="py-2 px-4">
                      <Link to={`/vendors/${v.id}`} className="font-medium hover:underline">{v.name}</Link>
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">{v.country || "—"}</td>
                    <td className="py-2 px-4"><StatusBadge status={v.status} /></td>
                    <td className="py-2 px-4 text-muted-foreground">{v.handler || "—"}</td>
                    <td className="py-2 px-4 mono text-xs text-muted-foreground">{(v.updated_at || "").slice(0, 16).replace("T", " ")}</td>
                    <td className="py-2 px-4">
                      <div className="flex flex-wrap gap-1">
                        {next.map((ns) => (
                          <button
                            key={ns}
                            disabled={busy}
                            onClick={() => { setMovingId(v.id); statusMut.mutate({ id: v.id, status: ns }); }}
                            data-testid={`queue-move-${v.id}-${ns}`}
                            className="text-[11px] px-2 py-0.5 rounded border border-border hover:border-primary hover:text-primary inline-flex items-center gap-0.5 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                            {statusMeta(ns).label}
                          </button>
                        ))}
                        {next.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                  {isLoading ? "Memuat…" : q ? `Tidak ada hasil untuk "${q}".` : "Tidak ada item."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
