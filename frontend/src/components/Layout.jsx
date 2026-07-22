import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ThemeSwitcher from "./ThemeSwitcher";
import {
  LayoutDashboard, ClipboardList, ListChecks, Activity, Globe2, TrendingUp,
  Users, Settings, LogOut, Menu, X, ShieldCheck, FileSpreadsheet, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";

const NAV = [
  { to: "/",          label: "Dashboard",     icon: LayoutDashboard,   testid: "nav-dashboard" },
  { to: "/ledger",    label: "Ledger",        icon: ClipboardList,     testid: "nav-ledger" },
  { to: "/queue",     label: "Antrian Saya",  icon: ListChecks,        testid: "nav-queue" },
  { to: "/monitor",   label: "Monitor",       icon: Activity,          testid: "nav-monitor" },
  { to: "/directory", label: "Country Ref.",  icon: Globe2,            testid: "nav-directory" },
  { to: "/insights",  label: "Insights & SLA", icon: TrendingUp,       testid: "nav-insights" },
];

const ADMIN_NAV = [
  { to: "/admin/users",  label: "Users",       icon: Users,       testid: "nav-admin-users", roles: ["admin"] },
  { to: "/admin/audit",  label: "Audit Log",   icon: ShieldCheck, testid: "nav-audit",       roles: ["admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingLeft: "env(safe-area-inset-left)" }}
        className={`sidebar-surface fixed lg:sticky top-0 left-0 z-40 h-screen shrink-0 transform transition-all duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[76px] w-64" : "w-64"}`}
      >
        <div className={`p-5 flex items-center border-b border-white/10 ${collapsed ? "lg:justify-center lg:px-3" : "justify-between"}`}>
          <div className={`flex items-center gap-2 min-w-0 ${collapsed ? "lg:gap-0" : ""}`}>
            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: "hsl(var(--sidebar-accent) / 0.2)" }}>
              <FileSpreadsheet className="w-5 h-5" style={{ color: "hsl(var(--sidebar-accent))" }} />
            </div>
            <div className={`leading-tight min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <div className="brand-title text-base text-white truncate">Vendor Tracker</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 truncate">Compliance Suite</div>
            </div>
          </div>
          <button
            data-testid="sidebar-close-mobile"
            className="lg:hidden text-white/70 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          data-testid="sidebar-collapse-toggle"
          onClick={() => setCollapsed((v) => !v)}
          className="hidden lg:flex items-center justify-center w-full py-2 text-white/50 hover:text-white hover:bg-white/5 border-b border-white/10"
          title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        <nav className="p-3 space-y-0.5">
          <div className={`overline px-2 pb-2 pt-1 ${collapsed ? "lg:hidden" : ""}`} style={{ color: "hsl(var(--sidebar-fg) / 0.5)" }}>Workflow</div>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              title={collapsed ? n.label : undefined}
              className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""} ${collapsed ? "lg:justify-center" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <n.icon className="w-4 h-4 shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>{n.label}</span>
            </NavLink>
          ))}

          {user?.role === "admin" && (
            <>
              <div className={`overline px-2 pt-4 pb-2 ${collapsed ? "lg:hidden" : ""}`} style={{ color: "hsl(var(--sidebar-fg) / 0.5)" }}>Admin</div>
              {ADMIN_NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  data-testid={n.testid}
                  title={collapsed ? n.label : undefined}
                  className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""} ${collapsed ? "lg:justify-center" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <n.icon className="w-4 h-4 shrink-0" />
                  <span className={collapsed ? "lg:hidden" : ""}>{n.label}</span>
                </NavLink>
              ))}
            </>
          )}

          <div className={`overline px-2 pt-4 pb-2 ${collapsed ? "lg:hidden" : ""}`} style={{ color: "hsl(var(--sidebar-fg) / 0.5)" }}>Preferences</div>
          <NavLink
            to="/settings"
            data-testid="nav-settings"
            title={collapsed ? "Settings" : undefined}
            className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""} ${collapsed ? "lg:justify-center" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            <Settings className="w-4 h-4 shrink-0" /><span className={collapsed ? "lg:hidden" : ""}>Settings</span>
          </NavLink>
        </nav>

        <div
          className={`absolute bottom-0 left-0 right-0 p-3 border-t border-white/10 ${collapsed ? "lg:hidden" : ""}`}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <div className="text-[11px] text-white/60 leading-4">
            Signed in as
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            <div className="text-white/50 text-[11px] truncate uppercase tracking-wider">{user?.role}</div>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="sticky top-0 z-20 bg-white border-b border-border"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div
            className="h-14 px-4 md:px-6 flex items-center justify-between gap-3"
            style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                data-testid="sidebar-toggle"
                className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Foreign Vendor</div>
                <div className="brand-title text-lg leading-tight truncate">Registration Tracker</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button data-testid="user-menu-btn" variant="outline" size="sm" className="h-9 gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                      {user?.name?.slice(0, 1).toUpperCase() || "U"}
                    </div>
                    <span className="hidden sm:inline text-sm">{user?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <div className="text-sm">{user?.name}</div>
                    {user?.email && <div className="text-xs text-muted-foreground">{user.email}</div>}
                    <div className="mt-1 inline-block text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {user?.role}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-settings" onClick={() => navigate("/settings")}>
                    <Settings className="w-4 h-4 mr-2" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-logout" onClick={async () => { await logout(); navigate("/login", { replace: true }); }}>
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main
          className="flex-1 p-4 md:p-6 route-fade"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
            paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
          }}
        >
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="bottom-right" toastOptions={{ style: { marginBottom: "env(safe-area-inset-bottom)" } }} />
    </div>
  );
}
