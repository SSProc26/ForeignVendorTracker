import React, { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, formatApiError } from "@/lib/api";
import { useWording } from "@/contexts/WordingContext";
import { wordingGroups, WORDING_DEFS } from "@/lib/wording";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw, Loader2, Search, Type } from "lucide-react";
import { toast } from "sonner";

export default function WordingEditor() {
  const { overrides, refresh } = useWording();
  const [draft, setDraft] = useState(null); // null until first edit; then a full map
  const [q, setQ] = useState("");

  const groups = useMemo(() => wordingGroups(), []);
  const current = useMemo(() => draft ?? overrides ?? {}, [draft, overrides]);

  const saveMut = useMutation({
    mutationFn: async (values) => (await api.put("/settings/wording", { values })).data,
    onSuccess: () => {
      refresh();
      setDraft(null);
      toast.success("Wording tersimpan — perubahan langsung berlaku");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  function setValue(key, val) {
    setDraft({ ...current, [key]: val });
  }

  function resetKey(key) {
    const next = { ...current };
    delete next[key];
    setDraft(next);
  }

  function resetAll() {
    if (!window.confirm("Kembalikan SEMUA wording ke teks bawaan?")) return;
    setDraft({});
  }

  const dirty = draft !== null;
  const overrideCount = Object.keys(current).filter((k) => current[k]?.trim()).length;

  const filteredGroups = useMemo(() => {
    if (!q.trim()) return groups;
    const needle = q.toLowerCase();
    const out = {};
    Object.entries(groups).forEach(([g, items]) => {
      const hits = items.filter(
        (it) =>
          it.key.toLowerCase().includes(needle) ||
          it.label.toLowerCase().includes(needle) ||
          it.default.toLowerCase().includes(needle) ||
          (current[it.key] || "").toLowerCase().includes(needle)
      );
      if (hits.length) out[g] = hits;
    });
    return out;
  }, [q, groups, current]);

  return (
    <Card className="p-5 space-y-4" data-testid="wording-editor">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="overline">Admin</div>
          <h3 className="text-base font-semibold mt-1 flex items-center gap-2">
            <Type className="w-4 h-4" /> Kustomisasi Wording
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Ubah teks yang tampil di aplikasi — halaman login, menu, judul, dan tombol.
            Kosongkan sebuah field untuk memakai teks bawaan.
            {overrideCount > 0 && ` (${overrideCount} teks dikustomisasi)`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetAll} data-testid="wording-reset-all">
            <RotateCcw className="w-4 h-4 mr-1.5" /> Reset Semua
          </Button>
          <Button
            size="sm"
            disabled={!dirty || saveMut.isPending}
            onClick={() => saveMut.mutate(current)}
            data-testid="wording-save"
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Simpan
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Cari teks / label…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="wording-search"
        />
      </div>

      {Object.keys(filteredGroups).length === 0 && (
        <div className="text-sm text-muted-foreground py-6 text-center">Tidak ada hasil untuk "{q}".</div>
      )}

      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {Object.entries(filteredGroups).map(([group, items]) => (
          <div key={group} className="space-y-2">
            <div className="overline sticky top-0 bg-card py-1">{group}</div>
            {items.map((it) => {
              const val = current[it.key] ?? "";
              const isOverridden = !!val.trim();
              return (
                <div key={it.key} className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-2 items-start">
                  <div className="min-w-0">
                    <Label className="text-xs">{it.label}</Label>
                    <div className="text-[10px] text-muted-foreground mono truncate">{it.key}</div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <Input
                      data-testid={`wording-input-${it.key}`}
                      value={val}
                      placeholder={it.default}
                      onChange={(e) => setValue(it.key, e.target.value)}
                      className={isOverridden ? "border-primary/50" : ""}
                    />
                    {isOverridden && (
                      <button
                        onClick={() => resetKey(it.key)}
                        title="Kembalikan ke teks bawaan"
                        className="p-1.5 text-muted-foreground hover:text-foreground shrink-0"
                        data-testid={`wording-reset-${it.key}`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {dirty && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Ada perubahan yang belum disimpan.
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">
        Total {Object.keys(WORDING_DEFS).length} teks dapat dikustomisasi.
      </div>
    </Card>
  );
}
