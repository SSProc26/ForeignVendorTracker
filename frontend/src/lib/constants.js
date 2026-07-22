export const TOKEN_KEY = "vt_token";
export const THEME_KEY = "vt_theme";
export const THEMES = [
  { id: "steel",     name: "Steel Blue", swatch: "#0d4a8a" },
  { id: "forest",    name: "Forest",     swatch: "#1b5e3a" },
  { id: "burgundy",  name: "Burgundy",   swatch: "#7a1f3d" },
  { id: "slate",     name: "Slate",      swatch: "#42505f" },
  { id: "copper",    name: "Copper",     swatch: "#b6612c" },
  { id: "editorial", name: "Editorial",  swatch: "#b9862f" },
];

export const ROLES = [
  { id: "admin",    label: "Admin" },
  { id: "approver", label: "Approver" },
  { id: "reviewer", label: "Reviewer" },
];

export const STATUSES = [
  { id: "DRAFT",             label: "Draft",                        className: "bg-slate-100 text-slate-700 border-slate-200",     dot: "bg-slate-400" },
  { id: "IN_REVIEW",         label: "In Review by Reviewer",        className: "bg-blue-50 text-blue-700 border-blue-200",         dot: "bg-blue-500" },
  { id: "CLARIFICATION",     label: "Clarification / Need Revision", className: "bg-orange-50 text-orange-700 border-orange-200",  dot: "bg-orange-500" },
  { id: "PENDING_APPROVAL",  label: "Pending Approval",             className: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-500" },
  { id: "RETURNED",          label: "Returned to Reviewer",         className: "bg-red-50 text-red-700 border-red-200",            dot: "bg-red-500" },
  { id: "APPROVED",          label: "Approved by Approver",         className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  { id: "MYSSC_REQUESTED",   label: "MySSC Requested",              className: "bg-indigo-50 text-indigo-700 border-indigo-200",   dot: "bg-indigo-500" },
  { id: "COMPLETED",         label: "Completed",                    className: "bg-teal-50 text-teal-700 border-teal-200",         dot: "bg-teal-600" },
];

// The 8 detailed statuses collapse into 3 general buckets for the primary badge shown
// on vendor cards/lists (matches original reference: only 3 buckets, auto-derived).
export const GENERAL_STATUS = {
  DRAFT: "Draft", IN_REVIEW: "Draft",
  CLARIFICATION: "In Progress", PENDING_APPROVAL: "In Progress", RETURNED: "In Progress", MYSSC_REQUESTED: "In Progress",
  APPROVED: "Approved", COMPLETED: "Approved",
};

export function generalStatusLabel(id) {
  return GENERAL_STATUS[id] || "Draft";
}

export function statusMeta(id) {
  return STATUSES.find((s) => s.id === id) || STATUSES[0];
}
