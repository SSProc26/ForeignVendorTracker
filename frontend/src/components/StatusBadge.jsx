import React from "react";
import { statusMeta } from "@/lib/constants";

export default function StatusBadge({ status }) {
  const s = statusMeta(status);
  return (
    <span
      data-testid={`status-badge-${s.id}`}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${s.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
