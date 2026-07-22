import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, KeyRound, Trash2, Loader2 } from "lucide-react";
import { ROLES } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_PASSCODE = "123456";

export default function AdminUsers() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
  });

  const [openNew, setOpenNew] = useState(false);
  const [n, setN] = useState({ name: "", role: "reviewer" });

  const createMut = useMutation({
    mutationFn: async (payload) => (await api.post("/users", payload)).data,
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(`Member "${u.name}" dibuat`, {
        description: `Passcode default: ${DEFAULT_PASSCODE}`,
      });
      setOpenNew(false);
      setN({ name: "", role: "reviewer" });
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }) => (await api.patch(`/users/${id}`, patch)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Member diupdate"); },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/users/${id}`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Member dihapus"); },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const resetMut = useMutation({
    mutationFn: async (id) => (await api.post(`/users/${id}/reset-password`, {})).data,
    onSuccess: (d) => toast.success(`Passcode direset ke ${d.passcode}`),
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  return (
    <div className="space-y-5" data-testid="admin-users-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">Admin</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Member Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola member, role & status aktif. Passcode default: <span className="mono">{DEFAULT_PASSCODE}</span>.
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="new-user-btn"><Plus className="w-4 h-4 mr-1.5" /> New Member</Button>
          </DialogTrigger>
          <DialogContent data-testid="new-user-dialog">
            <DialogHeader><DialogTitle>Tambah Member Baru</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nama</Label>
                <Input data-testid="new-user-name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder="Nama lengkap" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={n.role} onValueChange={(v) => setN({ ...n, role: v })}>
                  <SelectTrigger data-testid="new-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs bg-muted/50 border border-border rounded p-2.5 text-muted-foreground">
                Member baru akan bisa login dengan passcode default <span className="font-mono font-semibold text-foreground">{DEFAULT_PASSCODE}</span>. Sarankan mereka mengganti di menu Settings.
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenNew(false)}>Batal</Button>
              <Button
                data-testid="new-user-save"
                disabled={!n.name.trim() || createMut.isPending}
                onClick={() => createMut.mutate(n)}
              >
                {createMut.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Buat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left overline">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Active</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border" data-testid={`user-row-${u.id}`}>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                        {u.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{u.name}</div>
                        {u.email && <div className="text-[11px] text-muted-foreground">{u.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateMut.mutate({ id: u.id, patch: { role: v } })}
                      disabled={u.id === me.id}
                    >
                      <SelectTrigger data-testid={`user-role-${u.id}`} className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-4">
                    <Switch
                      data-testid={`user-active-${u.id}`}
                      checked={u.active}
                      disabled={u.id === me.id}
                      onCheckedChange={(v) => updateMut.mutate({ id: u.id, patch: { active: v } })}
                    />
                  </td>
                  <td className="py-2 px-4 mono text-xs text-muted-foreground">{(u.created_at || "").slice(0, 10)}</td>
                  <td className="py-2 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        data-testid={`user-reset-${u.id}`}
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => window.confirm(`Reset passcode "${u.name}" ke ${DEFAULT_PASSCODE}?`) && resetMut.mutate(u.id)}
                      >
                        <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset
                      </Button>
                      <Button
                        data-testid={`user-delete-${u.id}`}
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:text-destructive"
                        disabled={u.id === me.id}
                        onClick={() => window.confirm(`Hapus member ${u.name}?`) && delMut.mutate(u.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && users.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Belum ada member.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
