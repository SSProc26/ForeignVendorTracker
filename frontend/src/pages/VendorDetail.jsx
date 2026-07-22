import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiError, API_BASE } from "@/lib/api";
import { TOKEN_KEY } from "@/lib/constants";
import { statusMeta } from "@/lib/constants";
import WorkflowStepper from "@/components/WorkflowStepper";
import StatusBadge from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Save, Send, CheckCircle2, XCircle, Upload, File as FileIcon,
  Trash2, Loader2, Info, PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import ImageReferenceDrawer from "@/components/ImageReferenceDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { useWording } from "@/contexts/WordingContext";

export default function VendorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { t } = useWording();

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor", id],
    queryFn: async () => (await api.get(`/vendors/${id}`)).data,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/reference/categories")).data,
  });
  const { data: countryDb = {} } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => (await api.get("/reference/countries")).data,
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["documents", id],
    queryFn: async () => (await api.get(`/vendors/${id}/documents`)).data,
  });
  const { data: generalDocs = {} } = useQuery({
    queryKey: ["general-docs"],
    queryFn: async () => (await api.get("/reference/general-docs")).data,
  });
  const [drawerCat, setDrawerCat] = useState(null);
  const [drawerRef, setDrawerRef] = useState(null);

  const [form, setForm] = useState(null);
  const [historyText, setHistoryText] = useState("");
  const [uploadingKey, setUploadingKey] = useState(null);
  useEffect(() => { if (vendor) setForm(vendor); }, [vendor]);

  const saveMut = useMutation({
    mutationFn: async (payload) => (await api.put(`/vendors/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Perubahan disimpan");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const statusMut = useMutation({
    mutationFn: async ({ status, note }) => (await api.post(`/vendors/${id}/status`, { status, note })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Status diperbarui");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const uploadMut = useMutation({
    mutationFn: async ({ category, file }) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post(`/vendors/${id}/documents?category=${encodeURIComponent(category)}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", id] });
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      toast.success("Dokumen di-upload");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const delDocMut = useMutation({
    mutationFn: async (docId) => (await api.delete(`/documents/${docId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", id] });
      toast.success("Dokumen dihapus");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const historyMut = useMutation({
    mutationFn: async (text) => (await api.post(`/vendors/${id}/history`, { text })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor", id] }); toast.success("Catatan history ditambahkan"); },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const grouped = useMemo(() => {
    const g = {};
    categories.forEach((c) => { g[c.group] = g[c.group] || []; g[c.group].push(c); });
    return g;
  }, [categories]);

  if (isLoading || !form) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function setField(path, value) {
    setForm((f) => {
      const next = structuredClone(f);
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = (cur[parts[i]] = cur[parts[i]] || {});
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }

  function save() {
    const { history, ...payload } = form; // eslint-disable-line no-unused-vars
    saveMut.mutate(payload);
  }

  const canApprove = user.role === "admin" || user.role === "approver";
  const canSubmit  = user.role !== "approver"; // reviewer/admin submit
  const country = form.country && countryDb[form.country];

  function getCatRef(cat) {
    if (cat.scope === "general") return generalDocs[cat.key];
    return country?.categories?.[cat.key];
  }

  return (
    <div className="space-y-4" data-testid="vendor-detail-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => nav("/ledger")} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="back-to-ledger">
            <ArrowLeft className="w-4 h-4" /> Ledger
          </button>
          <div className="border-l border-border h-5" />
          <div>
            <div className="overline">Vendor Record</div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{form.name}</h1>
          </div>
          <StatusBadge status={form.status} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {canSubmit && form.status === "DRAFT" && (
            <Button data-testid="submit-review-btn" size="sm" variant="outline" onClick={() => statusMut.mutate({ status: "IN_REVIEW", note: "Submitted for review" })}>
              <PlayCircle className="w-4 h-4 mr-1.5" /> {t("vendor.startReview")}
            </Button>
          )}
          {canSubmit && form.status === "IN_REVIEW" && (
            <>
              <Button data-testid="submit-approval-btn" size="sm" variant="outline" onClick={() => statusMut.mutate({ status: "PENDING_APPROVAL", note: "Sent for approval" })}>
                <Send className="w-4 h-4 mr-1.5" /> {t("vendor.sendApprover")}
              </Button>
              <Button data-testid="request-clarification-btn" size="sm" variant="outline" onClick={() => statusMut.mutate({ status: "CLARIFICATION", note: "Perlu klarifikasi/revisi" })}>
                <Info className="w-4 h-4 mr-1.5" /> {t("vendor.clarify")}
              </Button>
            </>
          )}
          {canSubmit && form.status === "CLARIFICATION" && (
            <Button data-testid="resume-review-btn" size="sm" variant="outline" onClick={() => statusMut.mutate({ status: "IN_REVIEW", note: "Klarifikasi selesai, lanjut review" })}>
              <PlayCircle className="w-4 h-4 mr-1.5" /> Lanjutkan Review
            </Button>
          )}
          {canSubmit && form.status === "RETURNED" && (
            <Button data-testid="resubmit-btn" size="sm" variant="outline" onClick={() => statusMut.mutate({ status: "IN_REVIEW", note: "Submit ulang setelah returned" })}>
              <PlayCircle className="w-4 h-4 mr-1.5" /> Submit Ulang
            </Button>
          )}
          {canApprove && form.status === "PENDING_APPROVAL" && (
            <>
              <Button data-testid="approve-btn" size="sm" onClick={() => statusMut.mutate({ status: "APPROVED", note: form.approverNotes || "" })}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> {t("vendor.approve")}
              </Button>
              <Button data-testid="return-btn" size="sm" variant="destructive" onClick={() => statusMut.mutate({ status: "RETURNED", note: form.approverNotes || "Returned" })}>
                <XCircle className="w-4 h-4 mr-1.5" /> {t("vendor.return")}
              </Button>
            </>
          )}
          {canApprove && form.status === "APPROVED" && (
            <Button data-testid="request-myssc-btn" size="sm" variant="outline" onClick={() => statusMut.mutate({ status: "MYSSC_REQUESTED", note: "MySSC diminta" })}>
              <Send className="w-4 h-4 mr-1.5" /> {t("vendor.requestMyssc")}
            </Button>
          )}
          {canApprove && form.status === "MYSSC_REQUESTED" && (
            <Button data-testid="mark-completed-btn" size="sm" onClick={() => statusMut.mutate({ status: "COMPLETED", note: "Selesai" })}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> {t("vendor.markCompleted")}
            </Button>
          )}
          <Button data-testid="save-btn" size="sm" onClick={save} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} {t("vendor.save")}
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <WorkflowStepper current={form.status} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="company" className="w-full">
            <TabsList data-testid="vendor-tabs">
              <TabsTrigger value="company" data-testid="tab-company">Company Info</TabsTrigger>
              <TabsTrigger value="checklist" data-testid="tab-checklist">Doc Checklist</TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
              <TabsTrigger value="master" data-testid="tab-master">Master Data</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-3">
              <Card className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Vendor Name">
                    <Input data-testid="field-name" value={form.name || ""} onChange={(e) => setField("name", e.target.value)} />
                  </Field>
                  <Field label="Country">
                    <Select value={form.country || ""} onValueChange={(v) => setField("country", v)}>
                      <SelectTrigger data-testid="field-country"><SelectValue placeholder="Pilih negara" /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(countryDb).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="Lainnya">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Address">
                    <Input value={form.company?.address || ""} onChange={(e) => setField("company.address", e.target.value)} />
                  </Field>
                  <Field label="City">
                    <Input value={form.company?.city || ""} onChange={(e) => setField("company.city", e.target.value)} />
                  </Field>
                  <Field label="Province / State">
                    <Input value={form.company?.province || ""} onChange={(e) => setField("company.province", e.target.value)} />
                  </Field>
                  <Field label="Email">
                    <Input value={form.company?.email || ""} onChange={(e) => setField("company.email", e.target.value)} />
                  </Field>
                  <Field label="Tax ID">
                    <Input value={form.company?.taxId || ""} onChange={(e) => setField("company.taxId", e.target.value)} />
                  </Field>
                  <Field label="Total Equity">
                    <Input value={form.company?.totalEquity || ""} onChange={(e) => setField("company.totalEquity", e.target.value)} />
                  </Field>
                </div>
                <Field label="Company Notes">
                  <Textarea rows={3} value={form.company?.note || ""} onChange={(e) => setField("company.note", e.target.value)} />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Field label="Bank Name">
                    <Input value={form.company?.bank?.bankName || ""} onChange={(e) => setField("company.bank.bankName", e.target.value)} />
                  </Field>
                  <Field label="Account #">
                    <Input value={form.company?.bank?.account || ""} onChange={(e) => setField("company.bank.account", e.target.value)} />
                  </Field>
                  <Field label="Holder">
                    <Input value={form.company?.bank?.holder || ""} onChange={(e) => setField("company.bank.holder", e.target.value)} />
                  </Field>
                  <Field label="Bank Note">
                    <Input value={form.company?.bank?.note || ""} onChange={(e) => setField("company.bank.note", e.target.value)} />
                  </Field>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-3">
              {Object.entries(grouped).map(([group, cats]) => (
                <Card key={group} className="p-5">
                  <div className="overline mb-3">{group}</div>
                  <div className="space-y-3">
                    {cats.map((c) => {
                      const st = form.categories?.[c.key] || { complete: false, note: "" };
                      const cRef = country && country.categories?.[c.key];
                      return (
                        <div key={c.key} className="border border-border rounded p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  data-testid={`cat-check-${c.key}`}
                                  checked={!!st.complete}
                                  onCheckedChange={(v) => setField(`categories.${c.key}.complete`, !!v)}
                                />
                                <span className="text-sm font-medium">{c.label}</span>
                              </label>
                            </div>
                            {c.scope === "country" && (
                              <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Country-specific</span>
                            )}
                          </div>
                          {cRef && (
                            <div className="mt-2 text-xs bg-muted/50 border border-border rounded px-2.5 py-2">
                              <div className="flex items-center gap-1 overline text-[10px]"><Info className="w-3 h-3" /> Reference ({country.tag})</div>
                              <div className="mt-1"><span className="font-medium">Contoh:</span> {cRef.example}</div>
                              <div className="text-muted-foreground"><span className="font-medium">Concern:</span> {cRef.concern}</div>
                            </div>
                          )}
                          <Textarea
                            data-testid={`cat-note-${c.key}`}
                            className="mt-2 text-sm"
                            rows={2}
                            placeholder="Reviewer notes..."
                            value={st.note || ""}
                            onChange={(e) => setField(`categories.${c.key}.note`, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="documents" className="space-y-3">
              <Card className="p-5">
                <div className="overline mb-3">Upload Dokumen</div>
                <div className="space-y-3">
                  {categories.map((c) => {
                    const docs = documents.filter((d) => d.category === c.key);
                    return (
                      <div key={c.key} className="border border-border rounded p-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="text-sm font-medium">{c.label}</div>
                            <div className="text-[11px] text-muted-foreground">{c.group}</div>
                            {getCatRef(c) && (
                              <button
                                type="button"
                                data-testid={`view-example-${c.key}`}
                                className="mt-1 text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                                onClick={() => { setDrawerCat(c); setDrawerRef(getCatRef(c)); }}
                              >
                                🖼 {t("directory.viewExample")}
                              </button>
                            )}
                          </div>
                          <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-border rounded hover:bg-muted" data-testid={`upload-${c.key}`}>
                            {uploadingKey === c.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            Upload
                            <input
                              type="file"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingKey(c.key);
                                await uploadMut.mutateAsync({ category: c.key, file });
                                setUploadingKey(null);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                        {docs.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {docs.map((d) => (
                              <div key={d.id} className="flex items-center justify-between text-xs border border-border rounded px-2 py-1.5 bg-muted/30">
                                <a
                                  href={`${API_BASE}/documents/${d.id}/download?auth=${encodeURIComponent(localStorage.getItem(TOKEN_KEY) || "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 hover:underline text-primary"
                                  data-testid={`doc-view-${d.id}`}
                                >
                                  <FileIcon className="w-3.5 h-3.5" /> {d.filename}
                                </a>
                                <div className="flex items-center gap-3">
                                  <span className="mono text-muted-foreground">{Math.round((d.size || 0) / 1024)} KB</span>
                                  <button
                                    data-testid={`doc-del-${d.id}`}
                                    className="text-destructive hover:underline inline-flex items-center gap-1"
                                    onClick={() => window.confirm("Hapus dokumen?") && delDocMut.mutate(d.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="master" className="space-y-3">
              <Card className="p-5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="SAP Vendor ID"><Input value={form.masterData?.vendorId || ""} onChange={(e) => setField("masterData.vendorId", e.target.value)} /></Field>
                  <Field label="Provinsi"><Input value={form.masterData?.provinsi || ""} onChange={(e) => setField("masterData.provinsi", e.target.value)} /></Field>
                  <Field label="Default Email SAP"><Input value={form.masterData?.defaultEmailSap || ""} onChange={(e) => setField("masterData.defaultEmailSap", e.target.value)} /></Field>
                  <Field label="Company Code"><Input value={form.masterData?.companyCode || ""} onChange={(e) => setField("masterData.companyCode", e.target.value)} /></Field>
                  <Field label="Purch Org"><Input value={form.masterData?.purchOrg || ""} onChange={(e) => setField("masterData.purchOrg", e.target.value)} /></Field>
                  <Field label="Kualifikasi"><Input value={form.masterData?.kualifikasi || ""} onChange={(e) => setField("masterData.kualifikasi", e.target.value)} /></Field>
                  <Field label="CSMS"><Input value={form.masterData?.csms || ""} onChange={(e) => setField("masterData.csms", e.target.value)} /></Field>
                  <Field label="Klasifikasi Bidang"><Input value={form.masterData?.klasifikasiBidang || ""} onChange={(e) => setField("masterData.klasifikasiBidang", e.target.value)} /></Field>
                  <Field label="Direktur"><Input value={form.masterData?.direktur || ""} onChange={(e) => setField("masterData.direktur", e.target.value)} /></Field>
                  <Field label="NPWP Direktur"><Input value={form.masterData?.npwpDirektur || ""} onChange={(e) => setField("masterData.npwpDirektur", e.target.value)} /></Field>
                  <Field label="Komisaris"><Input value={form.masterData?.komisaris || ""} onChange={(e) => setField("masterData.komisaris", e.target.value)} /></Field>
                  <Field label="NPWP Komisaris"><Input value={form.masterData?.npwpKomisaris || ""} onChange={(e) => setField("masterData.npwpKomisaris", e.target.value)} /></Field>
                </div>
                <Field label="Note General"><Textarea rows={2} value={form.masterData?.noteGeneral || ""} onChange={(e) => setField("masterData.noteGeneral", e.target.value)} /></Field>
                <Field label="Merged Doc Link"><Input value={form.masterData?.mergedDocLink || ""} onChange={(e) => setField("masterData.mergedDocLink", e.target.value)} /></Field>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              <Card className="p-5">
                <div className="overline mb-3">Riwayat</div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                  {(form.history || []).slice().reverse().map((h) => (
                    <div key={h.id} className="border-l-2 border-primary/40 pl-3 py-1.5">
                      <div className="text-xs mono text-muted-foreground">{h.ts?.slice(0, 19).replace("T", " ")}</div>
                      <div className="text-sm">{h.text}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2 items-start">
                  <Input
                    data-testid="history-input"
                    value={historyText}
                    onChange={(e) => setHistoryText(e.target.value)}
                    placeholder="Tambah catatan manual..."
                    className="h-9"
                  />
                  <Button
                    data-testid="history-add-btn"
                    size="sm"
                    disabled={!historyText.trim()}
                    onClick={() => { historyMut.mutate(historyText.trim()); setHistoryText(""); }}
                  >Tambah</Button>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="overline">Workflow</div>
            <div className="mt-2 space-y-3">
              <Field label="Current Handler">
                <Input data-testid="field-handler" value={form.handler || ""} onChange={(e) => setField("handler", e.target.value)} />
              </Field>
              <Field label="MySSC Request #">
                <Input value={form.myssc || ""} onChange={(e) => setField("myssc", e.target.value)} />
              </Field>
              <Field label="Shared Folder Path">
                <Input value={form.path || ""} onChange={(e) => setField("path", e.target.value)} />
              </Field>
              <Field label="Reviewer Notes">
                <Textarea rows={3} value={form.reviewerNotes || ""} onChange={(e) => setField("reviewerNotes", e.target.value)} />
              </Field>
              <Field label="Approver Notes">
                <Textarea rows={3} value={form.approverNotes || ""} onChange={(e) => setField("approverNotes", e.target.value)} />
              </Field>
            </div>
          </Card>

          {country && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="overline">Country Reference</div>
                <span className="mono text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">{country.tag}</span>
              </div>
              <div className="mt-2 text-sm">
                <div><span className="text-muted-foreground">Apostille:</span> {country.apostille ? "Ya" : "Tidak"}</div>
                <Link to="/directory" className="text-xs text-primary hover:underline mt-2 inline-block">Lihat semua panduan negara →</Link>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ImageReferenceDrawer
        open={!!drawerCat}
        onClose={() => setDrawerCat(null)}
        category={drawerCat}
        country={form.country}
        refEntry={drawerRef}
      />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
