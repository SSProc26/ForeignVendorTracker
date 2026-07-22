import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiError } from "@/lib/api";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import { STATUSES, statusMeta, allowedTransitions } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, ChevronRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export default function Monitor() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("ALL");
  const [movingId, setMovingId] = useState(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["monitor"],
    queryFn: async () => (await api.get("/vendors")).data,
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }) =>
      (await api.post(`/vendors/${id}/status`, { status, note: "Diubah dari Monitor" })).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["monitor"] });
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

  const countries = useMemo(
    () => Array.from(new Set(data.map((v) => v.country).filter(Boolean))).sort(),
    [data]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter((v) => {
      if (country !== "ALL" && v.country !== country) return false;
      if (!needle) return true;
      return (
        (v.name || "").toLowerCase().includes(needle) ||
        (v.country || "").toLowerCase().includes(needle) ||
        (v.handler || "").toLowerCase().includes(needle)
      );
    });
  }, [data, q, country]);

  const byStatus = useMemo(
    () => STATUSES.reduce((acc, s) => ({ ...acc, [s.id]: filtered.filter((v) => v.status === s.id) }), {}),
    [filtered]
  );

  function move(id, status) {
    setMovingId(id);
    statusMut.mutate({ id, status });
  }

  return (
    <div className="space-y-5" data-testid="monitor-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">Kanban</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Monitor Workflow</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Peta status semua vendor dalam pipeline. Gunakan tombol pada kartu untuk memajukan status.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="monitor-search"
              className="pl-8 w-56"
              placeholder="Cari vendor / handler…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-44" data-testid="monitor-country-filter">
              <SelectValue placeholder="Semua negara" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua negara</SelectItem>
              {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(q || country !== "ALL") && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Menampilkan {filtered.length} dari {data.length} vendor
          </span>
          <button
            data-testid="monitor-clear-filters"
            onClick={() => { setQ(""); setCountry("ALL"); }}
            className="px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1 hover:bg-primary/20"
          >
            Reset filter <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <Card key={s.id} className="p-4" data-testid={`monitor-col-${s.id}`}>
            <div className="flex items-center justify-between">
              <StatusBadge status={s.id} />
              <span className="mono text-xs text-muted-foreground">{byStatus[s.id].length}</span>
            </div>
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto">
              {byStatus[s.id].map((v) => {
                const next = allowedTransitions(v.status, user.role);
                const busy = movingId === v.id;
                return (
                  <div
                    key={v.id}
                    className="border border-border rounded p-2 hover:bg-muted/40 transition"
                    data-testid={`monitor-item-${v.id}`}
                  >
                    <Link to={`/vendors/${v.id}`} className="block">
                      <div className="text-sm font-medium truncate hover:underline">{v.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {v.country || "—"} · {v.handler || "—"}
                      </div>
                    </Link>
                    {next.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {next.map((ns) => (
                          <button
                            key={ns}
                            disabled={busy}
                            onClick={() => move(v.id, ns)}
                            data-testid={`monitor-move-${v.id}-${ns}`}
                            title={`Pindahkan ke ${statusMeta(ns).label}`}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:border-primary hover:text-primary inline-flex items-center gap-0.5 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ChevronRight className="w-2.5 h-2.5" />}
                            {statusMeta(ns).label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {byStatus[s.id].length === 0 && (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  {isLoading ? "Memuat…" : "Kosong"}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
