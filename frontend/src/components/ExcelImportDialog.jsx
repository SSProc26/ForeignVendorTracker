import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { parseWorkbook } from "@/lib/excelImport";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ExcelImportDialog({ open, onOpenChange, onCreate, creating }) {
  const fileRef = useRef(null);
  const [parsing, setParsing] = useState(false);
  const [detected, setDetected] = useState(null);
  const [mode, setMode] = useState(null);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/reference/categories")).data,
  });

  function reset() {
    setDetected(null);
    setMode(null);
    setFileName("");
    setParsing(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file) {
    if (!file) return;
    const okExt = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!okExt) {
      toast.error("Format tidak didukung. Gunakan file .xlsx, .xls, atau .csv");
      return;
    }
    setParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const catKeys = categories.map((c) => c.key);
      const result = parseWorkbook(buf, catKeys);
      setDetected(result.detected);
      setMode(result.mode);
      if (result.mode === "template") {
        toast.success("Template terdeteksi — data berhasil dibaca");
      } else {
        toast.warning('Sheet "Company Information"/"Document checklist" tidak ditemukan — memakai pembacaan generik');
      }
    } catch (e) {
      console.error("[import] parse failed", e);
      toast.error("Gagal membaca file Excel. Pastikan file tidak rusak/terproteksi password.");
      reset();
    } finally {
      setParsing(false);
    }
  }

  function submit() {
    if (!detected?.name?.trim()) {
      toast.error("Nama vendor wajib diisi");
      return;
    }
    onCreate({
      name: detected.name.trim(),
      country: (detected.country || "").trim(),
      categories: detected.categories,
      company: detected.company,
    });
  }

  const catByKey = Object.fromEntries(categories.map((c) => [c.key, c]));
  const filledCats = detected
    ? Object.entries(detected.categories).filter(([, v]) => v.note || v.sourceValue)
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="excel-import-dialog">
        <DialogHeader>
          <DialogTitle>Import dari Form Excel Vendor</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          Unggah form Excel yang sudah diisi vendor (template "FORM FOR FOREIGN ENTITY" — sheet{" "}
          <i>Company Information</i> &amp; <i>Document checklist</i> terdeteksi otomatis). Anda tetap
          dapat mengoreksi hasilnya sebelum disimpan.
        </p>

        {!detected && (
          <label
            data-testid="excel-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            {parsing ? (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <div className="text-sm text-muted-foreground">Membaca {fileName}…</div>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                <div className="text-sm font-medium">Klik untuk pilih file, atau letakkan di sini</div>
                <div className="text-xs text-muted-foreground">.xlsx, .xls, atau .csv</div>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        )}

        {detected && (
          <div className="space-y-4">
            <div
              className={`text-xs rounded border p-2.5 flex items-start gap-2 ${
                mode === "template"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              {mode === "template" ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <div className="font-medium">
                  {mode === "template" ? "Template FORM FOR FOREIGN ENTITY terdeteksi" : "Pembacaan generik"}
                </div>
                <div className="opacity-80">{fileName}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vendor Name *</Label>
                <Input
                  data-testid="import-name"
                  value={detected.name || ""}
                  onChange={(e) => setDetected({ ...detected, name: e.target.value })}
                  placeholder="Nama vendor"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Input
                  data-testid="import-country"
                  value={detected.country || ""}
                  onChange={(e) => setDetected({ ...detected, country: e.target.value })}
                  placeholder="Negara"
                />
              </div>
            </div>

            {detected.company && (detected.company.address || detected.company.email || detected.company.taxId) && (
              <div className="text-xs border border-border rounded p-3 space-y-1 bg-muted/30">
                <div className="font-medium mb-1">Company Information terbaca:</div>
                {detected.company.address && <div><span className="text-muted-foreground">Alamat:</span> {detected.company.address}</div>}
                {detected.company.city && <div><span className="text-muted-foreground">Kota:</span> {detected.company.city}</div>}
                {detected.company.email && <div><span className="text-muted-foreground">Email:</span> {detected.company.email}</div>}
                {detected.company.taxId && <div><span className="text-muted-foreground">Tax ID:</span> {detected.company.taxId}</div>}
                {detected.company.bank?.account && <div><span className="text-muted-foreground">Rek. Bank:</span> {detected.company.bank.account} ({detected.company.bank.bankName})</div>}
                {detected.company.bod?.length > 0 && <div><span className="text-muted-foreground">Direksi:</span> {detected.company.bod.length} orang</div>}
                {detected.company.shareholders?.length > 0 && <div><span className="text-muted-foreground">Shareholder:</span> {detected.company.shareholders.length} entri</div>}
              </div>
            )}

            <div>
              <div className="overline mb-2">
                Catatan per Kategori Dokumen ({filledCats.length} terbaca)
              </div>
              {filledCats.length === 0 ? (
                <div className="text-xs text-muted-foreground border border-border rounded p-3">
                  Tidak ada catatan dokumen yang terbaca dari file. Anda tetap bisa membuat record dan
                  mengisi checklist secara manual setelahnya.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filledCats.map(([key, val]) => (
                    <div key={key} className="border border-border rounded p-2.5" data-testid={`import-cat-${key}`}>
                      <div className="text-xs font-medium">{catByKey[key]?.label || key}</div>
                      {val.sourceValue && (
                        <div className="mt-1 text-[11px] bg-muted/50 rounded px-2 py-1">
                          <span className="uppercase tracking-wide text-muted-foreground text-[10px]">Dari form vendor</span>
                          <div className="mt-0.5 whitespace-pre-wrap">{val.sourceValue}</div>
                        </div>
                      )}
                      <Textarea
                        className="mt-1.5 text-xs min-h-[52px]"
                        value={val.note || ""}
                        placeholder="Catatan reviewer untuk kategori ini…"
                        onChange={(e) =>
                          setDetected({
                            ...detected,
                            categories: { ...detected.categories, [key]: { ...val, note: e.target.value } },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground mt-2">
                Status kelengkapan sengaja dimulai dari <b>Incomplete</b> — centang manual setelah Anda
                memverifikasi dokumen aslinya, bukan mengikuti klaim vendor di Excel.
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {detected && (
            <Button variant="outline" onClick={reset} data-testid="import-reset-btn">
              Pilih file lain
            </Button>
          )}
          <Button
            onClick={submit}
            disabled={!detected || creating}
            data-testid="import-create-btn"
          >
            {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
            Buat Record dari Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
