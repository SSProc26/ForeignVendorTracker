import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STATUSES, statusMeta } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Link, useNavigate } from "react-router-dom";
import { useWording } from "@/contexts/WordingContext";
import { ArrowUpRight, Building2, Users2, FileCheck2, Files } from "lucide-react";

const PIE_COLORS = ["#64748b", "#3b82f6", "#f97316", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#0d9488"];

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useWording();
  const { data: sum } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => (await api.get("/analytics/summary")).data,
  });
  const { data: latest } = useQuery({
    queryKey: ["vendors-latest"],
    queryFn: async () => (await api.get("/vendors")).data,
  });

  const kpis = [
    { label: t("dashboard.kpiTotal"), value: sum?.total_vendors ?? "—", icon: Building2, to: "/ledger" },
    { label: t("dashboard.kpiApproved"), value: sum?.status_counts?.APPROVED ?? "—", icon: FileCheck2, to: "/ledger?status=APPROVED" },
    { label: t("dashboard.kpiDocs"), value: sum?.total_documents ?? "—", icon: Files, to: "/ledger" },
    { label: t("dashboard.kpiUsers"), value: sum?.total_users ?? "—", icon: Users2, to: "/admin/users" },
  ];

  const statusData = STATUSES.map((s) => ({
    id: s.id,
    name: s.label,
    value: sum?.status_counts?.[s.id] || 0,
  }));

  const countryData = (sum?.country_counts || []).slice(0, 8);

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">Overview</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} data-testid={`kpi-card-${k.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <Card className="p-5 cursor-pointer hover:border-primary hover:shadow-sm transition-colors group">
              <div className="flex items-start justify-between">
                <div>
                  <div className="overline">{k.label}</div>
                  <div className="text-2xl font-semibold mt-2 tabular-nums">{k.value}</div>
                </div>
                <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <k.icon className="w-4 h-4" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="overline">Vendors per Country</div>
              <h3 className="text-base font-semibold mt-1">Top 8 Countries</h3>
            </div>
          </div>
          <div className="h-64">
            {countryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Belum ada data vendor.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryData}>
                  <XAxis dataKey="country" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => navigate(`/ledger?country=${encodeURIComponent(data.country)}`)}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="overline">Status Distribution</div>
          <h3 className="text-base font-semibold mt-1 mb-2">Workflow</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={70}
                  innerRadius={40}
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(data) => navigate(`/ledger?status=${data.id}`)}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="overline">Latest Records</div>
            <h3 className="text-base font-semibold mt-1">Recent Vendors</h3>
          </div>
          <Link to="/ledger" className="text-sm text-primary hover:underline inline-flex items-center gap-1" data-testid="dashboard-view-ledger">
            View ledger <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left overline">
                <th className="py-2 pr-4">Vendor</th>
                <th className="py-2 pr-4">Country</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Handler</th>
                <th className="py-2 pr-4">Updated</th>
              </tr>
            </thead>
            <tbody>
              {(latest || []).slice(0, 6).map((v) => {
                const s = statusMeta(v.status);
                return (
                  <tr key={v.id} className="border-t border-border hover:bg-muted/40">
                    <td className="py-2 pr-4">
                      <Link to={`/vendors/${v.id}`} className="font-medium hover:underline" data-testid={`dashboard-vendor-${v.id}`}>
                        {v.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{v.country || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${s.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{v.handler || "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs mono">{(v.updated_at || "").slice(0, 16).replace("T", " ")}</td>
                  </tr>
                );
              })}
              {(!latest || latest.length === 0) && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-sm">Belum ada vendor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
