import React from "react";
import { X, Search, ImageIcon } from "lucide-react";

/**
 * Slide-over drawer showing document example search links (Google Images, Bing Images,
 * sample scan search) for a given document category + country. Mirrors the original
 * openImageDrawer() behavior from the reference HTML: since example documents vary by
 * country and change over time, this opens a live image search in a new tab rather than
 * a static (and potentially stale/wrong) image.
 */
export default function ImageReferenceDrawer({ open, onClose, category, country, refEntry }) {
  if (!open || !category) return null;

  const baseQuery = `${category.label} ${refEntry?.example || ""} ${country || ""}`.trim();
  const links = [
    {
      label: "Google Images",
      sub: baseQuery,
      href: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(baseQuery + " example document")}`,
    },
    {
      label: "Bing Images",
      sub: "official template",
      href: `https://www.bing.com/images/search?q=${encodeURIComponent(baseQuery + " official template")}`,
    },
    {
      label: "Contoh scan/spesimen",
      sub: `sample scan — ${country || ""}`,
      href: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${category.label} ${country || ""} sample scan`)}`,
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
        onClick={onClose}
        data-testid="image-drawer-backdrop"
      />
      <div
        className="fixed top-0 right-0 h-screen w-full max-w-sm bg-card border-l border-border z-[61] flex flex-col shadow-xl"
        data-testid="image-drawer"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-2">
              <ImageIcon className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm leading-tight">{category.label}</h3>
            <div className="text-xs text-muted-foreground mt-0.5">{country}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0"
            data-testid="image-drawer-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {refEntry && (
            <div className="text-xs bg-muted/40 border border-border rounded p-3 space-y-1.5">
              <div><span className="font-medium">Contoh dokumen ({country}):</span> {refEntry.example}</div>
              {refEntry.concern && (
                <div className="text-muted-foreground">⚠ {refEntry.concern}</div>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground leading-relaxed">
            Contoh gambar dokumen berbeda-beda tiap negara dan berubah dari waktu ke waktu, jadi panel ini
            membuka pencarian gambar real-time di tab baru — bukan gambar statis yang bisa basi atau salah negara.
          </div>

          <div className="space-y-2">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                data-testid={`image-drawer-link-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Search className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{l.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{l.sub}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
