import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Globe2, ShieldCheck } from "lucide-react";

export default function Directory() {
  const { data: countryDb = {} } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => (await api.get("/reference/countries")).data,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/reference/categories")).data,
  });

  const names = Object.keys(countryDb);
  const [selected, setSelected] = useState(names[0] || "");
  React.useEffect(() => { if (!selected && names.length) setSelected(names[0]); }, [names, selected]);

  const info = countryDb[selected];
  const catByKey = Object.fromEntries(categories.map((c) => [c.key, c]));

  return (
    <div className="space-y-5" data-testid="directory-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">Reference</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Panduan Negara</h1>
          <p className="text-sm text-muted-foreground mt-1">Kebutuhan dokumen spesifik per negara & concern review.</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(info.categories).map(([key, entry]) => (
              <Card key={key} className="p-4" data-testid={`directory-item-${key}`}>
                <div className="overline">{catByKey[key]?.group || "Documents"}</div>
                <div className="font-semibold text-sm mt-0.5">{catByKey[key]?.label || key}</div>
                <div className="mt-2 text-xs bg-muted/40 border border-border rounded p-2">
                  <div><span className="font-medium">Contoh:</span> {entry.example}</div>
                  <div className="text-muted-foreground mt-1"><span className="font-medium">Concern:</span> {entry.concern}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
