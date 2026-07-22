import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { STATUSES } from "@/lib/constants";

export default function Monitor() {
  const { data = [] } = useQuery({
    queryKey: ["monitor"],
    queryFn: async () => (await api.get("/vendors")).data,
  });

  const byStatus = STATUSES.reduce((acc, s) => ({ ...acc, [s.id]: data.filter((v) => v.status === s.id) }), {});

  return (
    <div className="space-y-5" data-testid="monitor-page">
      <div>
        <div className="overline">Kanban</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Monitor Workflow</h1>
        <p className="text-sm text-muted-foreground mt-1">Peta status semua vendor dalam pipeline.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {STATUSES.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={s.id} />
              <span className="mono text-xs text-muted-foreground">{byStatus[s.id].length}</span>
            </div>
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto">
              {byStatus[s.id].map((v) => (
                <Link
                  key={v.id}
                  to={`/vendors/${v.id}`}
                  data-testid={`monitor-item-${v.id}`}
                  className="block border border-border rounded p-2 hover:bg-muted/40 transition"
                >
                  <div className="text-sm font-medium truncate">{v.name}</div>
                  <div className="text-[11px] text-muted-foreground">{v.country || "—"} · {v.handler || "—"}</div>
                </Link>
              ))}
              {byStatus[s.id].length === 0 && (
                <div className="text-xs text-muted-foreground py-4 text-center">Kosong</div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
