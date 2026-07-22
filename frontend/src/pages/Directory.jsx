import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Globe2, ShieldCheck, ImageIcon } from "lucide-react";
import ImageReferenceDrawer from "@/components/ImageReferenceDrawer";
import { useWording } from "@/contexts/WordingContext";

export default function Directory() {
  const { t } = useWording();
  const { data: countryDb = {} } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => (await api.get("/reference/countries")).data,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/reference/categories")).data,
  });
  const { data: generalDocs = {} } = useQuery({
    queryKey: ["general-docs"],
    queryFn: async () => (await api.get("/reference/general-docs")).data,
  });

  const names = Object.keys(countryDb);
  const [selected, setSelected] = useState(names[0] || "");
  React.useEffect(() => { if (!selected && names.length) setSelected(names[0]); }, [names, selected]);

  const [drawerCat, setDrawerCat] = useState(null);
  const [drawerRef, setDrawerRef] = useState(null);

  const info = countryDb[selected];

  // Build ref entry per category: general-scope categories use GENERAL_DOC_INFO (same
  // regardless of country), country-scope categories use this country's COUNTRY_DB entry.
  const entries = categories.map((c) => {
    const ref = c.scope === "general"
      ? generalDocs[c.key]
      : info?.categories?.[c.key];
    return { cat: c, ref };
  }).filter((e) => e.ref);

  const grouped = entries.reduce((acc, e) => {
    const g = e.cat.group || "Documents";
    (acc[g] = acc[g] || []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-5" data-testid="directory-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">Reference</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("directory.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("directory.subtitle")}</p>
        </div>
        <div className="w-64">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger data-testid="directory-country-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {names.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {info && (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center"><Globe2 className="w-5 h-5" /></div>
              <div>
                <div className="brand-title text-lg">{selected}</div>
                <div className="text-xs text-muted-foreground mono">{info.tag}</div>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <ShieldCheck className={`w-4 h-4 ${info.apostille ? "text-emerald-600" : "text-muted-foreground"}`} />
                <span>Apostille: {info.apostille ? "Ya" : "Tidak"}</span>
              </div>
            </div>
          </Card>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="space-y-3">
              <div className="overline">{group}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map(({ cat, ref }) => (
                  <Card
                    key={cat.key}
                    className="p-4 cursor-pointer hover:border-primary hover:shadow-sm transition-colors group"
                    data-testid={`directory-item-${cat.key}`}
                    onClick={() => { setDrawerCat(cat); setDrawerRef(ref); }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{cat.label}</div>
                        {cat.scope === "general" && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Berlaku semua negara</div>
                        )}
                      </div>
                      <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary" />
                    </div>
                    <div className="mt-2 text-xs bg-muted/40 border border-border rounded p-2">
                      <div><span className="font-medium">Contoh:</span> {ref.example}</div>
                      <div className="text-muted-foreground mt-1"><span className="font-medium">Concern:</span> {ref.concern}</div>
                    </div>
                    <div className="mt-2 text-xs text-primary inline-flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> {t("directory.viewExample")}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <ImageReferenceDrawer
        open={!!drawerCat}
        onClose={() => setDrawerCat(null)}
        category={drawerCat}
        country={selected}
        refEntry={drawerRef}
      />
    </div>
  );
}
