import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Palette, User, ShieldCheck, Smartphone, KeyRound, Delete, Loader2 } from "lucide-react";

const KEYS = ["1","2","3","4","5","6","7","8","9","clear","0","back"];

function PinInput({ value, setValue, label, testid }) {
  function press(k) {
    if (k === "back") return setValue(value.slice(0, -1));
    if (k === "clear") return setValue("");
    if (value.length >= 6) return;
    setValue(value + k);
  }
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2" data-testid={`${testid}-dots`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition ${value.length > i ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5" data-testid={testid}>
        {KEYS.map((k) => {
          const isNum = /^[0-9]$/.test(k);
          return (
            <button
              key={k}
              type="button"
              data-testid={`${testid}-key-${k}`}
              onClick={() => press(k)}
              className={`h-11 rounded border text-sm font-semibold transition select-none active:scale-95 ${
                isNum
                  ? "border-border bg-card hover:border-primary hover:bg-primary/5"
                  : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {k === "back" ? <Delete className="w-4 h-4 mx-auto" /> : k === "clear" ? "Clear" : k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const isStandalone =
    (typeof window !== "undefined") &&
    (window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true);

  async function submitPasscode() {
    if (cur.length !== 6 || next.length !== 6) return;
    setBusy(true);
    try {
      await api.post("/auth/change-passcode", { current_passcode: cur, new_passcode: next });
      toast.success("Passcode berhasil diganti");
      setCur(""); setNext("");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl" data-testid="settings-page">
      <div>
        <div className="overline">Preferences</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Personalisasi tampilan, ganti passcode, & info akun.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Palette className="w-5 h-5" /></div>
          <div>
            <h2 className="font-semibold">Tema Warna</h2>
            <p className="text-sm text-muted-foreground">Pilih dari 5 skema corporate. Tersimpan per user.</p>
          </div>
        </div>
        <ThemeSwitcher variant="grid" />
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
          <div>
            <h2 className="font-semibold">Ganti Passcode</h2>
            <p className="text-sm text-muted-foreground">Passcode 6-digit. Lupa? Minta admin reset (default <span className="mono">123456</span>).</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <PinInput label="Passcode Lama" value={cur} setValue={setCur} testid="current-passcode" />
          <PinInput label="Passcode Baru" value={next} setValue={setNext} testid="new-passcode" />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            data-testid="change-passcode-btn"
            disabled={cur.length !== 6 || next.length !== 6 || busy}
            onClick={submitPasscode}
          >
            {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Simpan Passcode
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><User className="w-5 h-5" /></div>
          <div>
            <h2 className="font-semibold">Info Akun</h2>
            <p className="text-sm text-muted-foreground">Detail login Anda saat ini.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <InfoRow label="Nama" value={user?.name} />
          <InfoRow label="Role" value={user?.role?.toUpperCase()} />
          <InfoRow label="Status" value={user?.active ? "Aktif" : "Nonaktif"} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Smartphone className="w-5 h-5" /></div>
          <div>
            <h2 className="font-semibold">Progressive Web App</h2>
            <p className="text-sm text-muted-foreground">
              {isStandalone
                ? "App terpasang sebagai PWA — Anda menggunakan versi standalone."
                : "Install Vendor Tracker sebagai PWA lewat menu browser (Add to Home Screen / Install App)."}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
          <div className="flex-1">
            <h2 className="font-semibold">Keamanan</h2>
            <p className="text-sm text-muted-foreground">
              Token JWT disimpan di localStorage (7 hari). Hubungi admin untuk reset passcode.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="border border-border rounded p-3 bg-muted/20">
      <div className="overline">{label}</div>
      <div className="text-sm font-medium mt-1 truncate">{value || "—"}</div>
    </div>
  );
}
