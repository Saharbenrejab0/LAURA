"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────────────── */

interface DuplicateWarning {
  field: string;
  severity: "auto_fixed" | "invalid" | "invalid_cleared" | "partial_fix" | "empty_required";
  message: string;
  original?: string;
  mapped_to?: string;
}

interface DuplicateResponse {
  draft: any;
  source_id: string;
  source_was_historical: boolean;
  warnings: DuplicateWarning[];
  auto_fixed_count: number;
  needs_attention_count: number;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* 1. DuplicateButton — place on the LOA detail page                 */
/* ═══════════════════════════════════════════════════════════════════ */

export function DuplicateButton({ loaId }: { loaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDuplicate = async () => {
    setLoading(true);
    try {
      const resp = await api.post<DuplicateResponse>(
        `/loa/${loaId}/duplicate`
      );
      const { draft, warnings } = resp.data;

      // Store warnings in sessionStorage so the edit page can show them
      if (warnings.length > 0) {
        sessionStorage.setItem(
          `duplicate_warnings_${draft.id}`,
          JSON.stringify(warnings)
        );
      }

      // Navigate to the new draft
      router.push(`/loa/${draft.id}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || "Could not duplicate this LOA.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDuplicate}
      disabled={loading}
      style={{
        background: "#1E40AF",
        color: "white",
        border: "none",
        borderRadius: "6px",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 500,
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.7 : 1,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {loading ? "Duplicating..." : "📋 Use as template"}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* 2. DuplicateWarningsBanner — place at top of LOA detail/edit page  */
/* ═══════════════════════════════════════════════════════════════════ */

export function DuplicateWarningsBanner({ loaId }: { loaId: string }) {
  const [warnings, setWarnings] = useState<DuplicateWarning[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = sessionStorage.getItem(`duplicate_warnings_${loaId}`);
    if (!raw) return [];
    // Clear after reading — show only once
    sessionStorage.removeItem(`duplicate_warnings_${loaId}`);
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });

  const [dismissed, setDismissed] = useState(false);

  if (warnings.length === 0 || dismissed) return null;

  const autoFixed = warnings.filter((w) => w.severity === "auto_fixed");
  const needsAttention = warnings.filter((w) => w.severity !== "auto_fixed");

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ fontWeight: 600, fontSize: "14px" }}>
          {"📋 Draft created from historical LOA"}
        </span>
        <button onClick={() => setDismissed(true)} style={styles.closeBtn}>
          {"✕"}
        </button>
      </div>

      {/* Auto-fixed (green) */}
      {autoFixed.length > 0 && (
        <div style={styles.autoFixedSection}>
          <p style={styles.sectionTitle}>
            {`✅ ${autoFixed.length} field${autoFixed.length > 1 ? "s" : ""} auto-corrected:`}
          </p>
          {autoFixed.map((w, i) => (
            <p key={i} style={styles.autoFixedItem}>
              <strong>{w.field}</strong>
              {`: "${w.original}" `}
              {"\u2192"}
              {` "${w.mapped_to}"`}
            </p>
          ))}
        </div>
      )}

      {/* Needs attention (amber/red) */}
      {needsAttention.length > 0 && (
        <div style={styles.attentionSection}>
          <p style={styles.sectionTitle}>
            {`⚠ ${needsAttention.length} field${needsAttention.length > 1 ? "s" : ""} need your attention:`}
          </p>
          {needsAttention.map((w, i) => (
            <p key={i} style={styles.attentionItem}>
              {w.severity === "empty_required" && "🟡 "}
              {w.severity === "invalid" && "🔴 "}
              {w.severity === "invalid_cleared" && "🔴 "}
              {w.severity === "partial_fix" && "🟠 "}
              {w.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#F0FDF4",
    border: "1px solid #BBF7D0",
    borderRadius: "8px",
    padding: "14px 16px",
    marginBottom: "16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    color: "#166534",
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    color: "#6B7280",
    padding: "2px 6px",
  },
  autoFixedSection: {
    marginBottom: "10px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 600,
    margin: "0 0 6px 0",
    color: "#374151",
  },
  autoFixedItem: {
    fontSize: "13px",
    margin: "0 0 4px 12px",
    color: "#166534",
  },
  attentionSection: {
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: "6px",
    padding: "10px 12px",
  },
  attentionItem: {
    fontSize: "13px",
    margin: "0 0 4px 0",
    color: "#78350F",
  },
};
