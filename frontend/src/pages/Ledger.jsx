import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiError } from "@/lib/api";
import { STATUSES, statusMeta } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Search, LayoutGrid, Rows3, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/api";
import { TOKEN_KEY } from "@/lib/constants";

export default function Ledger() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [view, setView] = useState("cards");
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [countries, setCountries] = useState([]);

  React.useEffect(() => {
    api.get("/reference/countries").then((r) => setCountries(Object.keys(r.data))).catch(() => {});
  }, []);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors", q, statusFilter],
    queryFn: async () => {
      const params = {};
      if (q) params.q = q;
      if (statusFilter !== "ALL") params.status = statusFilter;
      return (await api.get("/vendors", { params })).data;
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload) => (await api.post("/vendors", payload)).data,
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setOpen(false); setNewName(""); setNewCountry("");
      toast.success("Vendor dibuat");
      navigate(`/vendors/${v.id}`);
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/vendors/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor dihapus");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  function exportCsv() {
    const token = localStorage.getItem(TOKEN_KEY);
    fetch(`${API_BASE}/vendors-export/csv`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url; a.download = "vendors.csv"; a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error("Gagal export"));
  }

  const list = useMemo(() => vendors, [vendors]);

  return (
    <div className="space-y-5" data-testid="ledger-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">Records</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Vendor Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola, telusuri, dan telaah semua record vendor asing.</p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="export-csv-btn" variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="new-vendor-btn" size="sm"><Plus className="w-4 h-4 mr-1.5" /> New Vendor</Button>
            </DialogTrigger>
            <DialogContent data-testid="new-vendor-dialog">
              <DialogHeader><DialogTitle>Buat Record Vendor Baru</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nama Vendor</Label>
                  <Input data-testid="new-vendor-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="PT / Ltd / Inc..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Negara</Label>
                  <Select value={newCountry} onValueChange={setNewCountry}>
                    <SelectTrigger data-testid="new-vendor-country"><SelectValue placeholder="Pilih negara" /></SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)} data-testid="new-vendor-cancel">Batal</Button>
                <Button
                  data-testid="new-vendor-save"
                  disabled={!newName.trim() || createMut.isPending}
                  onClick={() => createMut.mutate({ name: newName.trim(), country: newCountry })}
                >
                  {createMut.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Buat
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="ledger-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama vendor..."
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="ledger-status-filter" className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center border border-border rounded overflow-hidden h-9">
            <button
              data-testid="view-cards-btn"
              onClick={() => setView("cards")}
              className={`px-3 h-full text-xs flex items-center gap-1 ${view === "cards" ? "bg-primary text-primary-foreground" : "bg-transparent"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              data-testid="view-table-btn"
              onClick={() => setView("table")}
              className={`px-3 h-full text-xs flex items-center gap-1 ${view === "table" ? "bg-primary text-primary-foreground" : "bg-transparent"}`}
            >
              <Rows3 className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          <div className="ml-auto text-xs text-muted-foreground" data-testid="ledger-count">
            {isLoading ? "Loading..." : `${list.length} record`}
          </div>
        </div>
      </Card>

      {view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((v) => {
            const s = statusMeta(v.status);
            const done = v.categories ? Object.values(v.categories).filter((c) => c.complete).length : 0;
            const total = v.categories ? Object.keys(v.categories).length : 0;
            return (
              <Card key={v.id} className="p-4 hover:-translate-y-[1px] transition" data-testid={`vendor-card-${v.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link to={`/vendors/${v.id}`} className="font-semibold hover:underline" data-testid={`vendor-link-${v.id}`}>
                      {v.name}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">{v.country || "—"}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${s.className}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="overline text-[10px]">Handler</div>
                    <div className="truncate">{v.handler || "—"}</div>
                  </div>
                  <div>
                    <div className="overline text-[10px]">Progress</div>
                    <div className="mono">{done}/{total}</div>
                  </div>
                  <div>
                    <div className="overline text-[10px]">Updated</div>
                    <div className="mono">{(v.updated_at || "").slice(0, 10)}</div>
                  </div>
                </div>
                <div className="mt-3 h-1 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: total > 0 ? `${(done / total) * 100}%` : 0 }}
                  />
                </div>
                {user?.role === "admin" && (
                  <div className="mt-3 pt-3 border-t border-border flex justify-end">
                    <button
                      data-testid={`vendor-delete-${v.id}`}
                      className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                      onClick={() => window.confirm("Hapus vendor ini?") && delMut.mutate(v.id)}
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
          {!isLoading && list.length === 0 && (
            <Card className="p-8 col-span-full text-center text-sm text-muted-foreground">
              Belum ada vendor. Klik <span className="font-medium">New Vendor</span> untuk memulai.
            </Card>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left overline">
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Country</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Handler</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Updated</th>
                </tr>
              </thead>
              <tbody>
                {list.map((v) => {
                  const s = statusMeta(v.status);
                  const done = v.categories ? Object.values(v.categories).filter((c) => c.complete).length : 0;
                  const total = v.categories ? Object.keys(v.categories).length : 0;
                  return (
                    <tr key={v.id} className="border-t border-border hover:bg-muted/40" data-testid={`vendor-row-${v.id}`}>
                      <td className="py-2 px-4">
                        <Link to={`/vendors/${v.id}`} className="font-medium hover:underline">{v.name}</Link>
                      </td>
                      <td className="py-2 px-4 text-muted-foreground">{v.country || "—"}</td>
                      <td className="py-2 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${s.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-muted-foreground">{v.handler || "—"}</td>
                      <td className="py-2 px-4 mono text-xs">{done}/{total}</td>
                      <td className="py-2 px-4 mono text-xs text-muted-foreground">{(v.updated_at || "").slice(0, 16).replace("T", " ")}</td>
                    </tr>
                  );
                })}
                {!isLoading && list.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">Belum ada vendor.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
