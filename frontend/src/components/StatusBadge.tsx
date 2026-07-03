'use client';

/**
 * StatusBadge - encodes LOA workflow state visually.
 * Used in Tracker rows, Past Campaigns rows, draft header, search results.
 * The semantic ramp comes from tokens.statusBadge.
 */

import { statusBadge, font } from '@/styles/tokens';

interface StatusBadgeProps {
  /** Status string as stored in DB (case-insensitive, underscores or spaces). */
  status: string;
  /** Optional size variant. Default 24px height. */
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const key = (status || '').toLowerCase().replace(/[\s-]+/g, '_').replace(/\//g, '_') as keyof typeof statusBadge;
  const s = statusBadge[key] ?? statusBadge.draft;

  const height = size === 'sm' ? 20 : 24;
  const fontSize = size === 'sm' ? 11 : 12;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height,
        padding: '0 8px',
        borderRadius: 999,
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        fontFamily: font.sans,
        fontSize,
        lineHeight: `${height - 2}px`,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}
