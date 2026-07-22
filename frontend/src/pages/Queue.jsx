import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { statusMeta } from "@/lib/constants";

export default function Queue() {
  const { user } = useAuth();
  const targetStatus = user.role === "approver" ? "PENDING_APPROVAL" : "IN_REVIEW";
  const { data = [] } = useQuery({
    queryKey: ["queue", targetStatus],
    queryFn: async () => (await api.get("/vendors", { params: { status: targetStatus } })).data,
  });

  return (
    <div className="space-y-4" data-testid="queue-page">
      <div>
        <div className="overline">Action Required</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Antrian Saya</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vendor yang menunggu tindakan Anda ({statusMeta(targetStatus).label}).
        </p>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left overline">
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Country</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Handler</th>
                <th className="py-3 px-4">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id} className="border-t border-border hover:bg-muted/40" data-testid={`queue-row-${v.id}`}>
                  <td className="py-2 px-4">
                    <Link to={`/vendors/${v.id}`} className="font-medium hover:underline">{v.name}</Link>
                  </td>
                  <td className="py-2 px-4 text-muted-foreground">{v.country || "—"}</td>
                  <td className="py-2 px-4"><StatusBadge status={v.status} /></td>
                  <td className="py-2 px-4 text-muted-foreground">{v.handler || "—"}</td>
                  <td className="py-2 px-4 mono text-xs text-muted-foreground">{(v.updated_at || "").slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Tidak ada item.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
