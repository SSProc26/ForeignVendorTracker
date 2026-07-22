/**
 * All user-facing copy that an admin can override from Settings → Wording.
 * Each key maps to { default, group, label } — `group` drives the admin editor's
 * sections, `label` explains where the text appears.
 *
 * Usage in components:  const t = useWording();  ...  {t("login.title")}
 */
export const WORDING_DEFS = {
  // ---- Login ----
  "login.brand":        { default: "Vendor Tracker",              group: "Login", label: "Nama brand di halaman login" },
  "login.tagline":      { default: "Compliance Suite",            group: "Login", label: "Tagline di bawah brand" },
  "login.title":        { default: "Masuk ke Akun Anda",          group: "Login", label: "Judul form login" },
  "login.subtitle":     { default: "Gunakan User ID dan passcode 6 digit Anda.", group: "Login", label: "Subjudul form login" },
  "login.userIdLabel":  { default: "User ID",                     group: "Login", label: "Label field User ID" },
  "login.passcodeLabel":{ default: "Passcode",                    group: "Login", label: "Label field passcode" },
  "login.submit":       { default: "Masuk",                       group: "Login", label: "Tombol submit login" },

  // ---- Navigation ----
  "nav.dashboard":  { default: "Dashboard",       group: "Navigasi", label: "Menu Dashboard" },
  "nav.ledger":     { default: "Ledger",          group: "Navigasi", label: "Menu Ledger" },
  "nav.queue":      { default: "Antrian Saya",    group: "Navigasi", label: "Menu Antrian" },
  "nav.monitor":    { default: "Monitor",         group: "Navigasi", label: "Menu Monitor" },
  "nav.directory":  { default: "Country Ref.",    group: "Navigasi", label: "Menu Panduan Negara" },
  "nav.insights":   { default: "Insights & SLA",  group: "Navigasi", label: "Menu Insights" },
  "nav.users":      { default: "Users",           group: "Navigasi", label: "Menu Admin Users" },
  "nav.audit":      { default: "Audit Log",       group: "Navigasi", label: "Menu Audit Log" },
  "nav.settings":   { default: "Settings",        group: "Navigasi", label: "Menu Settings" },
  "nav.groupWorkflow":    { default: "Workflow",     group: "Navigasi", label: "Judul grup menu workflow" },
  "nav.groupAdmin":       { default: "Admin",        group: "Navigasi", label: "Judul grup menu admin" },
  "nav.groupPreferences": { default: "Preferences",  group: "Navigasi", label: "Judul grup menu preferensi" },

  // ---- App header ----
  "app.brand":       { default: "Vendor Tracker",         group: "Header", label: "Nama brand di sidebar" },
  "app.brandSub":    { default: "Compliance Suite",       group: "Header", label: "Sub-brand di sidebar" },
  "app.headerOver":  { default: "Foreign Vendor",         group: "Header", label: "Teks kecil di atas judul header" },
  "app.headerTitle": { default: "Registration Tracker",   group: "Header", label: "Judul utama di header" },

  // ---- Dashboard ----
  "dashboard.title":     { default: "Dashboard", group: "Dashboard", label: "Judul halaman" },
  "dashboard.subtitle":  { default: "Ringkasan status vendor & aktivitas terkini.", group: "Dashboard", label: "Subjudul halaman" },
  "dashboard.kpiTotal":  { default: "Total Vendors", group: "Dashboard", label: "Label KPI total vendor" },
  "dashboard.kpiApproved": { default: "Approved", group: "Dashboard", label: "Label KPI approved" },
  "dashboard.kpiDocs":   { default: "Documents", group: "Dashboard", label: "Label KPI dokumen" },
  "dashboard.kpiUsers":  { default: "Users", group: "Dashboard", label: "Label KPI users" },

  // ---- Ledger ----
  "ledger.title":       { default: "Vendor Ledger", group: "Ledger", label: "Judul halaman ledger" },
  "ledger.subtitle":    { default: "Kelola, telusuri, dan telaah semua record vendor asing.", group: "Ledger", label: "Subjudul ledger" },
  "ledger.newVendor":   { default: "New Vendor", group: "Ledger", label: "Tombol vendor baru" },
  "ledger.importExcel": { default: "Import Excel", group: "Ledger", label: "Tombol import Excel" },
  "ledger.exportCsv":   { default: "Export CSV", group: "Ledger", label: "Tombol export CSV" },
  "ledger.searchPlaceholder": { default: "Cari nama vendor…", group: "Ledger", label: "Placeholder pencarian" },
  "ledger.empty":       { default: "Belum ada vendor.", group: "Ledger", label: "Teks saat data kosong" },

  // ---- Directory ----
  "directory.title":    { default: "Panduan Negara", group: "Panduan Negara", label: "Judul halaman" },
  "directory.subtitle": { default: "Kebutuhan dokumen spesifik per negara & concern review.", group: "Panduan Negara", label: "Subjudul halaman" },
  "directory.viewExample": { default: "Lihat contoh gambar", group: "Panduan Negara", label: "Tombol lihat contoh gambar" },

  // ---- Vendor detail ----
  "vendor.save":        { default: "Simpan", group: "Detail Vendor", label: "Tombol simpan" },
  "vendor.startReview": { default: "Start Review", group: "Detail Vendor", label: "Tombol mulai review" },
  "vendor.sendApprover":{ default: "Kirim ke Approver", group: "Detail Vendor", label: "Tombol kirim ke approver" },
  "vendor.clarify":     { default: "Perlu Klarifikasi", group: "Detail Vendor", label: "Tombol minta klarifikasi" },
  "vendor.approve":     { default: "Approve", group: "Detail Vendor", label: "Tombol approve" },
  "vendor.return":      { default: "Return", group: "Detail Vendor", label: "Tombol return" },
  "vendor.requestMyssc":{ default: "Request MySSC", group: "Detail Vendor", label: "Tombol request MySSC" },
  "vendor.markCompleted": { default: "Mark Completed", group: "Detail Vendor", label: "Tombol tandai selesai" },

  // ---- Admin ----
  "admin.usersTitle":    { default: "Member Management", group: "Admin", label: "Judul halaman users" },
  "admin.usersSubtitle": { default: "Kelola member, role & status aktif.", group: "Admin", label: "Subjudul halaman users" },
  "admin.newMember":     { default: "New Member", group: "Admin", label: "Tombol member baru" },
};

export function defaultWording() {
  const o = {};
  Object.entries(WORDING_DEFS).forEach(([k, v]) => { o[k] = v.default; });
  return o;
}

export function wordingGroups() {
  const groups = {};
  Object.entries(WORDING_DEFS).forEach(([key, def]) => {
    (groups[def.group] = groups[def.group] || []).push({ key, ...def });
  });
  return groups;
}
