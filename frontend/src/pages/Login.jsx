import { useWording } from "@/contexts/WordingContext";
import React, { useState, useEffect, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/constants";
import { api, formatApiError } from "@/lib/api";
import {
  Loader2, ShieldCheck, Building2, Delete, User as UserIcon, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
const ROLE_TAG = {
  admin: { label: "Admin", cls: "bg-primary/10 text-primary" },
  approver: { label: "Approver", cls: "bg-amber-100 text-amber-800" },
  reviewer: { label: "Reviewer", cls: "bg-slate-100 text-slate-700" },
};

export default function Login() {
  const { user, loading, login } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useWording();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api.get("/auth/members")
      .then((r) => setMembers(r.data))
      .catch((e) => setErr(formatApiError(e.response?.data?.detail) || "Gagal memuat member"));
  }, []);

  const visibleMembers = useMemo(
    () => (showAll ? members : members.slice(0, 6)),
    [members, showAll]
  );

  useEffect(() => {
    if (pin.length === 6 && selected) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function submit() {
    if (!selected || pin.length !== 6) return;
    setErr("");
    setBusy(true);
    const res = await login(selected.id, pin);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || "Passcode salah");
      setPin("");
      return;
    }
    navigate("/", { replace: true });
  }

  function press(k) {
    if (busy) return;
    if (k === "back") return setPin((p) => p.slice(0, -1));
    if (k === "clear") return setPin("");
    if (pin.length >= 6) return;
    setPin((p) => p + k);
  }

  // keyboard support
  useEffect(() => {
    function onKey(e) {
      if (busy) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Enter") submit();
      else if (e.key === "Escape") press("clear");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, selected, pin]);

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background text-foreground">
      {/* Left brand panel */}
      <div className="relative hidden md:flex flex-col justify-between p-10 overflow-hidden sidebar-surface">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1567943183748-3a7542120c90?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400)",
            backgroundSize: "cover", backgroundPosition: "center", mixBlendMode: "overlay",
          }}
        />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-white/90">
            <ShieldCheck className="w-5 h-5" />
            <span className="overline" style={{ color: "hsl(var(--sidebar-fg) / 0.7)" }}>Compliance Platform</span>
          </div>
          <h1 className="brand-title text-white text-4xl leading-tight max-w-md">
            Foreign Vendor Registration Tracker
          </h1>
          <p className="text-white/70 text-sm max-w-md">
            Pilih akun, ketik passcode 6-digit, dan lanjutkan review vendor.
          </p>
        </div>
        <div className="relative z-10 space-y-3">
          <div className="text-xs uppercase tracking-widest text-white/60">Tema Perusahaan</div>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                data-testid={`login-theme-${t.id}`}
                onClick={() => setTheme(t.id)}
                className={`h-8 px-3 rounded-full border text-xs flex items-center gap-2 transition ${
                  theme === t.id
                    ? "bg-white/15 border-white/40 text-white"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                }`}
              >
                <span className="w-3 h-3 rounded-full border border-white/30" style={{ background: t.swatch }} />
                {t.name}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-white/50">v1.1 · PWA-ready · Mobile-friendly</div>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="brand-title text-lg leading-none">{t("login.brand")}</div>
              <div className="text-[11px] text-muted-foreground">{t("login.tagline")}</div>
            </div>
          </div>

          {!selected ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Pilih Member</h2>
              <p className="text-sm text-muted-foreground mt-1">Ketuk akun Anda untuk melanjutkan.</p>
              <div className="mt-5 space-y-2" data-testid="member-list">
                {members.length === 0 && !err && (
                  <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat member…
                  </div>
                )}
                {visibleMembers.map((m) => {
                  const tag = ROLE_TAG[m.role] || ROLE_TAG.reviewer;
                  return (
                    <button
                      key={m.id}
                      data-testid={`member-${m.id}`}
                      onClick={() => { setSelected(m); setPin(""); setErr(""); }}
                      className="w-full flex items-center gap-3 p-3 rounded border border-border hover:border-primary hover:bg-primary/5 transition text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                        {m.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{m.name}</div>
                        <div className={`inline-block text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${tag.cls}`}>{tag.label}</div>
                      </div>
                    </button>
                  );
                })}
                {members.length > 6 && (
                  <button
                    data-testid="toggle-more-members"
                    onClick={() => setShowAll((v) => !v)}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-2 flex items-center justify-center gap-1"
                  >
                    {showAll ? <>Tampilkan lebih sedikit <ChevronUp className="w-3 h-3" /></> : <>Lihat semua ({members.length}) <ChevronDown className="w-3 h-3" /></>}
                  </button>
                )}
              </div>
              {err && (
                <div data-testid="login-error" className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
                  {err}
                </div>
              )}
              <div className="mt-6 text-xs text-muted-foreground pt-4 border-t border-border">
                Default passcode untuk akun baru: <span className="mono">123456</span>
              </div>
            </>
          ) : (
            <>
              <button
                data-testid="back-to-members"
                onClick={() => { setSelected(null); setPin(""); setErr(""); }}
                className="text-xs text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1"
              >
                ← Ganti member
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {selected.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="brand-title text-lg leading-tight">{selected.name}</div>
                  <div className={`inline-block text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${ROLE_TAG[selected.role].cls}`}>
                    {ROLE_TAG[selected.role].label}
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>

              <div data-testid="pin-dots" className="mt-4 flex items-center justify-center gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full border-2 transition ${
                      pin.length > i ? "bg-primary border-primary scale-110" : "border-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>

              {err && (
                <div data-testid="login-error" className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 text-center">
                  {err}
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2" data-testid="pin-pad">
                {KEYS.map((k) => {
                  const isNum = /^[0-9]$/.test(k);
                  return (
                    <button
                      key={k}
                      data-testid={`pin-${k}`}
                      disabled={busy}
                      onClick={() => press(k)}
                      className={`h-14 rounded border text-lg font-semibold transition select-none active:scale-95 ${
                        isNum
                          ? "border-border bg-card hover:border-primary hover:bg-primary/5"
                          : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {k === "back" ? <Delete className="w-5 h-5 mx-auto" /> : k === "clear" ? "Clear" : k}
                    </button>
                  );
                })}
              </div>

              <Button
                data-testid="login-submit"
                className="w-full mt-4 h-11"
                disabled={pin.length !== 6 || busy}
                onClick={submit}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Sign in
              </Button>
              <div className="mt-3 text-[11px] text-muted-foreground text-center">
                Lupa passcode? Hubungi admin — akan direset ke <span className="mono">123456</span>.
              </div>
            </>
          )}
        </div>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
