import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/constants";
import { Check, Palette } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function ThemeSwitcher({ variant = "compact" }) {
  const { theme, setTheme } = useTheme();

  if (variant === "grid") {
    return (
      <div data-testid="theme-grid" className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            data-testid={`theme-option-${t.id}`}
            onClick={() => setTheme(t.id)}
            className={`text-left rounded-md border p-3 transition hover:-translate-y-[1px] hover:shadow-sm ${
              theme === t.id ? "border-primary ring-2 ring-primary/20" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{t.name}</span>
              {theme === t.id && <Check className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded" style={{ background: t.swatch }} />
              <span className="w-6 h-6 rounded bg-foreground/80" />
              <span className="w-6 h-6 rounded bg-muted border border-border" />
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="theme-switcher-btn"
          variant="outline"
          size="sm"
          className="gap-2 h-9"
        >
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">Tema</span>
          <span className="w-3 h-3 rounded-full border border-border" style={{ background: THEMES.find((t) => t.id === theme)?.swatch }} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs">Pilih Tema Warna</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            data-testid={`theme-menu-${t.id}`}
            onClick={() => setTheme(t.id)}
            className="cursor-pointer gap-2"
          >
            <span className="w-3 h-3 rounded-full border border-border" style={{ background: t.swatch }} />
            <span className="flex-1">{t.name}</span>
            {theme === t.id && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
