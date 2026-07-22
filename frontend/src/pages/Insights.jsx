import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import {
  Clock, TrendingUp, AlertTriangle, Award, MapPin, ListChecks, Timer, RotateCcw,
  Calendar, Target, FileDown,
} from "lucide-react";
import { STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api";
import { TOKEN_KEY } from "@/lib/constants";

const STATUS_COLORS = {
  DRAFT: "#64748b",
  IN_REVIEW: "#3b82f6",
  CLARIFICATION: "#f97316",
  PENDING_APPROVAL: "#f59e0b",
  APPROVED: "#10b981",
  RETURNED: "#ef4444",
  MYSSC_REQUESTED: "#6366f1",
  COMPLETED: "#0d9488",
};

function fmtDays(d) {
  if (d == null || Number.isNaN(d)) return "—";
  if (d < 1) return `${(d * 24).toFixed(1)}h`;
  return `${d.toFixed(1)}d`;
}

function agingSeverity(days) {
  if (days > 14) return "text-red-700 bg-red-50 border-red-200";
  if (days > 7)  return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-700 bg-slate-100 border-slate-200";
}

export default function Insights() {
  const { data, isLoading } = useQuery({
    queryKey: ["insights"],
    queryFn: async () => (await api.get("/analytics/insights")).data,
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground" data-testid="insights-loading">Menghitung insight…</div>;
  }

  const slaByStatus = data.sla_by_status || [];
  const slaByHandler = data.sla_by_handler || [];
  const aging = data.aging || [];
  const rr = data.return_rate || {};
  const trend = data.weekly_trend || [];
  const completeness = data.category_completeness || [];
  const country = data.country_risk || [];

  const totalTracked = slaByHandler.reduce((a, h) => a + h.approved_count, 0);
  const avgOverall =
    totalTracked > 0
      ? slaByHandler.reduce((a, h) => a + h.avg_days_to_approved * h.approved_count, 0) / totalTracked
      : 0;
  const slowestStatus = [...slaByStatus].filter(s => s.count > 0).sort((a, b) => b.avg_days - a.avg_days)[0];
  const worstAging = aging[0];
  const heatmap = data.time_heatmap || [];
  const rework = data.rework || { distribution: [], top_vendors: [], avg_per_approved: 0, max_loops: 0 };
  const eta = data.eta || [];

  function exportPdf() {
    const token = localStorage.getItem(TOKEN_KEY);
    window.open(`${API_BASE}/analytics/insights-pdf?auth=${encodeURIComponent(token)}`, "_blank");
  }

  return (
    <div className="space-y-5" data-testid="insights-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">Performance</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Insights & SLA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Durasi pengerjaan, rata-rata SLA, aging, return rate, heatmap produktivitas, dan ETA prediktif.
          </p>
        </div>
        <Button data-testid="export-pdf-btn" variant="outline" size="sm" onClick={exportPdf}>
          <FileDown className="w-4 h-4 mr-1.5" /> Export PDF
        </Button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Timer}
          label="Rata-rata Total → Approved"
          value={fmtDays(avgOverall)}
          hint={`${totalTracked} vendor selesai`}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Bottleneck Status"
          value={slowestStatus ? `${STATUSES.find(s => s.id === slowestStatus.status)?.label}` : "—"}
          hint={slowestStatus ? `${fmtDays(slowestStatus.avg_days)} avg dwell` : "belum ada data"}
        />
        <KpiCard
          icon={RotateCcw}
          label="Return Rate"
          value={`${rr.rate_pct ?? 0}%`}
          hint={`${rr.returned} return · ${rr.approved} approved`}
        />
        <KpiCard
          icon={Clock}
          label="Vendor Tertua di Antrian"
          value={worstAging ? fmtDays(worstAging.days_in_status) : "—"}
          hint={worstAging ? worstAging.name : "kosong"}
        />
      </div>

      {/* SLA per status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="overline">Dwell Time</div>
              <h3 className="font-semibold flex items-center gap-1.5"><Timer className="w-4 h-4" /> Rata-rata Waktu per Status</h3>
            </div>
            <div className="text-xs text-muted-foreground">unit: hari</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slaByStatus.map(s => ({
                ...s,
                label: STATUSES.find(x => x.id === s.status)?.label || s.status,
              }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v, k) => [`${Number(v).toFixed(2)} d`, k]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="avg_days" name="Avg" radius={[4, 4, 0, 0]}>
                  {slaByStatus.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.status] || "#64748b"} />)}
                </Bar>
                <Bar dataKey="median_days" name="Median" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="overline">Return vs Approved</div>
          <h3 className="font-semibold flex items-center gap-1.5 mt-0.5"><RotateCcw className="w-4 h-4" /> Rasio Keputusan</h3>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1"><span>Approved</span><span className="mono">{rr.approved}</span></div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${100 - (rr.rate_pct || 0)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span>Returned</span><span className="mono">{rr.returned}</span></div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${rr.rate_pct || 0}%` }} />
              </div>
            </div>
            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
              Return rate <span className="font-semibold text-foreground">{rr.rate_pct}%</span> — {rr.rate_pct > 20 ? "tinggi, review kualitas dokumen di awal." : "dalam batas wajar."}
            </div>
          </div>
        </Card>
      </div>

      {/* Trend */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="overline">Trend 8 Minggu</div>
            <h3 className="font-semibold flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Created vs Approved</h3>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="created" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Handler performance */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="overline">Handler Performance</div>
            <h3 className="font-semibold flex items-center gap-1.5"><Award className="w-4 h-4" /> Waktu Rata-rata Sampai Approved per Handler</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left overline">
              <tr>
                <th className="py-2 pr-4">Handler</th>
                <th className="py-2 pr-4 text-right">Approved</th>
                <th className="py-2 pr-4 text-right">Avg</th>
                <th className="py-2 pr-4 text-right">Median</th>
                <th className="py-2 pr-4 text-right">Fastest</th>
                <th className="py-2 pr-4 text-right">Slowest</th>
              </tr>
            </thead>
            <tbody>
              {slaByHandler.map((h) => (
                <tr key={h.user_id} className="border-t border-border" data-testid={`handler-row-${h.user_id}`}>
                  <td className="py-2 pr-4 font-medium">{h.name}</td>
                  <td className="py-2 pr-4 text-right mono">{h.approved_count}</td>
                  <td className="py-2 pr-4 text-right mono">{fmtDays(h.avg_days_to_approved)}</td>
                  <td className="py-2 pr-4 text-right mono">{fmtDays(h.median_days_to_approved)}</td>
                  <td className="py-2 pr-4 text-right mono text-emerald-700">{fmtDays(h.fastest_days)}</td>
                  <td className="py-2 pr-4 text-right mono text-red-700">{fmtDays(h.slowest_days)}</td>
                </tr>
              ))}
              {slaByHandler.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Belum ada vendor approved.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Aging */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="overline">Aging Report</div>
            <h3 className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Vendor Terlama di Status Saat Ini</h3>
          </div>
          <div className="text-xs text-muted-foreground">Top 10 · exclude Approved</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left overline">
              <tr>
                <th className="py-2 pr-4">Vendor</th>
                <th className="py-2 pr-4">Country</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Handler</th>
                <th className="py-2 pr-4 text-right">Days in Status</th>
              </tr>
            </thead>
            <tbody>
              {aging.slice(0, 10).map((a) => (
                <tr key={a.vendor_id} className="border-t border-border" data-testid={`aging-row-${a.vendor_id}`}>
                  <td className="py-2 pr-4">
                    <Link className="hover:underline font-medium" to={`/vendors/${a.vendor_id}`}>{a.name}</Link>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{a.country || "—"}</td>
                  <td className="py-2 pr-4"><StatusBadge status={a.status} /></td>
                  <td className="py-2 pr-4 text-muted-foreground">{a.handler || "—"}</td>
                  <td className="py-2 pr-4 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs mono ${agingSeverity(a.days_in_status)}`}>
                      {fmtDays(a.days_in_status)}
                    </span>
                  </td>
                </tr>
              ))}
              {aging.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Semua vendor sudah approved 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Country risk + Completeness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="overline">Per Country</div>
              <h3 className="font-semibold flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Country Risk Snapshot</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left overline">
                <tr>
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 pr-4 text-right">Approved</th>
                  <th className="py-2 pr-4 text-right">Returned</th>
                  <th className="py-2 pr-4 text-right">Avg → Approved</th>
                </tr>
              </thead>
              <tbody>
                {country.slice(0, 8).map((c) => (
                  <tr key={c.country} className="border-t border-border">
                    <td className="py-2 pr-4 font-medium">{c.country}</td>
                    <td className="py-2 pr-4 text-right mono">{c.count}</td>
                    <td className="py-2 pr-4 text-right mono text-emerald-700">{c.approved}</td>
                    <td className="py-2 pr-4 text-right mono text-red-700">{c.returned}</td>
                    <td className="py-2 pr-4 text-right mono">{fmtDays(c.avg_days_to_approved)}</td>
                  </tr>
                ))}
                {country.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Belum ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="overline">Document Coverage</div>
              <h3 className="font-semibold flex items-center gap-1.5"><ListChecks className="w-4 h-4" /> Kategori Paling Sering Belum Lengkap</h3>
            </div>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {completeness.slice(0, 10).map((c) => (
              <div key={c.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate mr-2">{c.label}</span>
                  <span className="mono text-muted-foreground shrink-0">{c.complete}/{c.total} · {c.rate}%</span>
                </div>
                <div className="h-1.5 rounded bg-muted overflow-hidden">
                  <div
                    className={`h-full ${c.rate < 30 ? "bg-red-500" : c.rate < 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${c.rate}%` }}
                  />
                </div>
              </div>
            ))}
            {completeness.length === 0 && <div className="text-sm text-muted-foreground py-4">Belum ada data.</div>}
          </div>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="overline">Team Activity</div>
            <h3 className="font-semibold flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Kapan Tim Paling Produktif</h3>
            <div className="text-xs text-muted-foreground mt-0.5">Jumlah transisi status per jam &amp; hari (7×24)</div>
          </div>
        </div>
        <Heatmap data={heatmap} />
      </Card>

      {/* Rework */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="overline">Rework Loops</div>
          <h3 className="font-semibold flex items-center gap-1.5 mt-0.5"><RotateCcw className="w-4 h-4" /> Distribusi Bolak-balik</h3>
          <div className="mt-3 space-y-2">
            {rework.distribution.map((r) => {
              const total = rework.distribution.reduce((a, x) => a + x.count, 0) || 1;
              const pct = (r.count / total) * 100;
              return (
                <div key={r.loops}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>{r.loops === "0" ? "Tanpa return" : `${r.loops} return`}</span>
                    <span className="mono text-muted-foreground">{r.count}</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div
                      className={`h-full ${r.loops === "0" ? "bg-emerald-500" : r.loops === "1" ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-muted-foreground pt-3 border-t border-border">
            Rata-rata rework per vendor approved: <span className="font-semibold text-foreground mono">{rework.avg_per_approved}</span>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="overline">Rework Hotlist</div>
          <h3 className="font-semibold flex items-center gap-1.5 mt-0.5"><RotateCcw className="w-4 h-4" /> Vendor dengan Return Terbanyak</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left overline">
                <tr>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Loops</th>
                </tr>
              </thead>
              <tbody>
                {rework.top_vendors.map((r) => (
                  <tr key={r.vendor_id} className="border-t border-border" data-testid={`rework-row-${r.vendor_id}`}>
                    <td className="py-2 pr-4">
                      <Link className="hover:underline font-medium" to={`/vendors/${r.vendor_id}`}>{r.name}</Link>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.country || "—"}</td>
                    <td className="py-2 pr-4"><StatusBadge status={r.status} /></td>
                    <td className="py-2 pr-4 text-right">
                      <span className="mono text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">×{r.loops}</span>
                    </td>
                  </tr>
                ))}
                {rework.top_vendors.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">Belum ada rework 🎯</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ETA */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="overline">Predictive ETA</div>
            <h3 className="font-semibold flex items-center gap-1.5"><Target className="w-4 h-4" /> Estimasi Kapan Akan Approved</h3>
            <div className="text-xs text-muted-foreground mt-0.5">
              Formula: baseline (avg per-country) × faktor kelengkapan dokumen. Overdue = melewati baseline.
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left overline">
              <tr>
                <th className="py-2 pr-4">Vendor</th>
                <th className="py-2 pr-4">Country</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Dokumen</th>
                <th className="py-2 pr-4 text-right">Terpakai</th>
                <th className="py-2 pr-4 text-right">ETA</th>
                <th className="py-2 pr-4">Target Tgl</th>
                <th className="py-2 pr-4">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {eta.slice(0, 12).map((e) => (
                <tr key={e.vendor_id} className="border-t border-border" data-testid={`eta-row-${e.vendor_id}`}>
                  <td className="py-2 pr-4">
                    <Link className="hover:underline font-medium" to={`/vendors/${e.vendor_id}`}>{e.name}</Link>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{e.country || "—"}</td>
                  <td className="py-2 pr-4"><StatusBadge status={e.status} /></td>
                  <td className="py-2 pr-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <div className="w-12 h-1.5 rounded bg-muted overflow-hidden">
                        <div className={`h-full ${e.completeness_pct < 30 ? "bg-red-500" : e.completeness_pct < 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${e.completeness_pct}%` }} />
                      </div>
                      <span className="mono text-xs text-muted-foreground">{e.completeness_pct}%</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right mono text-xs">{fmtDays(e.days_spent)}</td>
                  <td className="py-2 pr-4 text-right">
                    <span className={`mono text-xs px-2 py-0.5 rounded border ${e.overdue ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                      {e.overdue ? "Overdue" : fmtDays(e.eta_days)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 mono text-xs text-muted-foreground">{e.eta_date}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
                      e.confidence === "high" ? "bg-emerald-100 text-emerald-800" :
                      e.confidence === "medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                    }`}>{e.confidence}</span>
                  </td>
                </tr>
              ))}
              {eta.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground text-sm">Tidak ada vendor menunggu approval 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Heatmap({ data }) {
  const DAYS = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  data.forEach((c) => {
    grid[c.day][c.hour] = c.count;
    if (c.count > max) max = c.count;
  });
  const intensity = (v) => {
    if (max === 0) return 0;
    return Math.min(1, v / max);
  };
  return (
    <div data-testid="heatmap">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex items-center gap-1 pl-10 mb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="w-6 text-center text-[10px] text-muted-foreground mono">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>
          {DAYS.map((label, d) => (
            <div key={d} className="flex items-center gap-1 mb-1">
              <div className="w-9 text-[11px] text-muted-foreground mono">{label}</div>
              {grid[d].map((v, h) => (
                <div
                  key={h}
                  title={`${label} ${h}:00 — ${v} transisi`}
                  className="w-6 h-6 rounded"
                  style={{
                    background: v === 0
                      ? "hsl(var(--muted))"
                      : `hsl(var(--primary) / ${0.2 + 0.8 * intensity(v)})`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
        <span>0</span>
        {[0.2, 0.4, 0.6, 0.8, 1].map((a) => (
          <div key={a} className="w-4 h-3 rounded" style={{ background: `hsl(var(--primary) / ${a})` }} />
        ))}
        <span>{max}</span>
        <span className="ml-2">(setiap sel = jumlah transisi status dalam jam tersebut)</span>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="overline">{label}</div>
          <div className="text-2xl font-bold mt-1 truncate">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</div>}
        </div>
        <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </Card>
  );
}
