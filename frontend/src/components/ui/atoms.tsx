'use client';

/**
 * LAURA — Shared UI atoms (Editorial Finance redesign, Phase 1)
 * -------------------------------------------------------------
 * Pure presentational primitives. No data fetching, no business
 * logic. Colors come exclusively from CSS variables defined in
 * styles/redesign.css, so all atoms are automatically theme-aware.
 *
 * IMPORTANT: statusKind() accepts REAL backend status codes
 * (draft, emea_review, global_brand_review, …) as well as human
 * labels, so components can pass either without pre-mapping.
 */

import React from 'react';

/* ------------------------------ Fonts ------------------------------ */

export const F = {
  display: 'var(--font-display)',
  sans: 'var(--font-sans)',
  mono: 'var(--font-mono)',
} as const;

/* --------------------------- Status system ------------------------- */

export type StatusKind =
  | 'Draft' | 'Review' | 'Wait' | 'Rework'
  | 'Decision' | 'Approved' | 'Rejected' | 'Warn';

/** Real backend status codes → semantic kind */
const CODE_TO_KIND: Record<string, StatusKind> = {
  draft: 'Draft',
  emea_review: 'Review',
  global_brand_review: 'Wait',
  emea_brand_rework: 'Rework',
  global_functions_review: 'Wait',
  emea_functions_rework: 'Rework',
  cmo_cfo_review: 'Decision',
  emea_cmo_rework: 'Rework',
  corporate_review: 'Decision',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** Human labels → semantic kind (for places that pass display text) */
const LABEL_TO_KIND: Record<string, StatusKind> = {
  'Draft': 'Draft',
  'EMEA review': 'Review',
  'Under review': 'Review',
  'Brand review': 'Wait',
  'Functions review': 'Wait',
  'EMEA rework': 'Rework',
  'EMEA check': 'Rework',
  'EMEA final check': 'Rework',
  'CMO / CFO': 'Decision',
  'CMO / CFO review': 'Decision',
  'Corporate': 'Decision',
  'Corporate review': 'Decision',
  'Approved': 'Approved',
  'Rejected': 'Rejected',
  'PPT required': 'Warn',
};

/** Backend status code → short display label */
export const CODE_TO_LABEL: Record<string, string> = {
  draft: 'Draft',
  emea_review: 'EMEA review',
  global_brand_review: 'Brand review',
  emea_brand_rework: 'EMEA rework',
  global_functions_review: 'Functions review',
  emea_functions_rework: 'EMEA check',
  cmo_cfo_review: 'CMO / CFO',
  emea_cmo_rework: 'EMEA review',
  corporate_review: 'Corporate review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function statusKind(statusOrLabel: string): StatusKind {
  return (
    CODE_TO_KIND[statusOrLabel] ||
    LABEL_TO_KIND[statusOrLabel] ||
    'Draft'
  );
}

export function statusLabel(status: string): string {
  return CODE_TO_LABEL[status] || LABEL_TO_KIND[status] !== undefined
    ? (CODE_TO_LABEL[status] ?? status)
    : status;
}

export const KIND_VARS: Record<StatusKind, [string, string]> = {
  Draft: ['--st-draft-bg', '--st-draft-fg'],
  Review: ['--st-review-bg', '--st-review-fg'],
  Wait: ['--st-wait-bg', '--st-wait-fg'],
  Rework: ['--st-rework-bg', '--st-rework-fg'],
  Decision: ['--st-decision-bg', '--st-decision-fg'],
  Approved: ['--st-approved-bg', '--st-approved-fg'],
  Rejected: ['--st-rejected-bg', '--st-rejected-fg'],
  Warn: ['--st-warn-bg', '--st-warn-fg'],
};

/* ------------------------------- Pill ------------------------------ */

export function Pill({
  status,
  kind,
  label,
}: {
  /** Backend code ('emea_review') or display label ('EMEA review') */
  status: string;
  /** Force a kind, bypassing lookup (e.g. 'Warn' for PPT badge) */
  kind?: StatusKind;
  /** Force the display text; defaults to a smart label */
  label?: string;
}) {
  const k = kind || statusKind(status);
  const [bg, fg] = KIND_VARS[k];
  const text = label ?? CODE_TO_LABEL[status] ?? status;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11.5, fontWeight: 600, letterSpacing: '.02em',
      background: `var(${bg})`, color: `var(${fg})`,
      whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}

/* ------------------------------- Btn ------------------------------- */

export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Btn({
  variant = 'ghost',
  children,
  onClick,
  small,
  disabled,
  type = 'button',
  style,
  title,
}: {
  variant?: BtnVariant;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  small?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
  title?: string;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    height: small ? 30 : 36,
    padding: small ? '0 12px' : '0 16px',
    borderRadius: 8,
    fontSize: small ? 12.5 : 13.5,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all .15s ease',
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: 'var(--ink)', color: 'var(--ink-text)' },
    secondary: { background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' },
    ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { background: 'transparent', color: 'var(--st-rejected-fg)', border: '1px solid var(--st-rejected-fg)' },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget;
        if (variant === 'primary') el.style.opacity = '0.88';
        else { el.style.borderColor = 'var(--border-strong)'; el.style.color = 'var(--text-primary)'; }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.opacity = disabled ? '0.5' : '1';
        Object.assign(el.style, variants[variant]);
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Avatar ----------------------------- */

export function Avatar({ initials, size = 24 }: { initials: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-sunken)', border: '1px solid var(--border)',
      color: 'var(--text-secondary)',
      fontSize: Math.max(9, size * 0.38), fontWeight: 700,
      fontFamily: 'var(--font-sans)', letterSpacing: '.02em',
      textTransform: 'uppercase',
    }}>
      {initials}
    </span>
  );
}

/** Derive initials from a full name or email */
export function initialsOf(nameOrEmail?: string | null): string {
  if (!nameOrEmail) return '?';
  // 1) drop anything after '(' or '@'  → "Justine (Meta Marketer)" → "Justine"
  const base = nameOrEmail.split('(')[0].split('@')[0].trim();
  // 2) normalise separators
  const clean = base.replace(/[._\-]+/g, ' ').trim();
  if (!clean) return '?';
  // 3) letters only, take first letter of each token
  const parts = clean.split(/\s+/).filter(p => /[A-Za-zÀ-ÿ]/.test(p));
  if (parts.length === 0) return '?';
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const single = parts[0];
  return (single.length >= 2 ? single.slice(0, 2) : single).toUpperCase();
}

/* ----------------------------- Overline ---------------------------- */

export function Overline({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700,
      letterSpacing: '.09em', textTransform: 'uppercase',
      color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)',
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ------------------------------- Ring ------------------------------ */

/** Progress ring, pct in [0, 1] */
export function Ring({ pct, size = 44 }: { pct: number; size?: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const done = clamped >= 1;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }} role="img" aria-label={`${Math.round(clamped * 100)}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={done ? 'var(--st-approved-fg)' : 'var(--gold)'}
        strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${c * clamped} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray .5s ease' }}
      />
      {done && (
        <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
          fontSize={size * 0.32} fill="var(--st-approved-fg)" fontWeight={700}>✓</text>
      )}
    </svg>
  );
}

/* ------------------------------ Spark ------------------------------ */

/** Tiny sparkline */
export function Spark({ data, w = 72, h = 26, good = true }: {
  data: number[]; w?: number; h?: number; good?: boolean;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - 3 - ((v - min) / range) * (h - 6)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      <polyline
        points={pts} fill="none"
        stroke={good ? 'var(--st-approved-fg)' : 'var(--st-rejected-fg)'}
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

/* ------------------------------- Card ------------------------------ */

export function Card({
  children, hover, onClick, style, padding = 20,
}: {
  children: React.ReactNode;
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  padding?: number | string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`la-card ${hover || onClick ? 'la-hover' : ''}`}
      onClick={onClick}
      style={{
        padding,
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-primary)',
        width: onClick ? '100%' : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/* --------------------------- Money helper -------------------------- */

/** Format thousands of EUR: fmtK(45) → "€45k" · fmtK(1250) → "€1.25M" */
export function fmtK(kEur: number): string {
  if (kEur >= 1000) return `€${(kEur / 1000).toFixed(kEur % 1000 === 0 ? 0 : 2)}M`;
  if (kEur === 0) return '€0';
  return `€${kEur}k`;
}

/** Format raw EUR amounts: fmtEur(45000) → "€45k" */
export function fmtEur(eur: number): string {
  return fmtK(Math.round(eur / 1000));
}
