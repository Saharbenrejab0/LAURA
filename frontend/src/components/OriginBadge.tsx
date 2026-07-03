'use client';

/**
 * OriginBadge - shows the source LOA for a duplicate, gated by lifecycle.
 *
 *   draft / rejected -> "Duplicated from {sourceId}"  (gold tones, prominent)
 *   under review     -> "Based on {sourceId}"         (neutral tones, calmer)
 *   approved         -> nothing (the artifact stands on its own; origin lives
 *                       in the timeline + ID tooltip only)
 *
 * The decision to suppress on approved is from the design spec - it prevents
 * approved LOAs from feeling like copies.
 */

import { originBadge, font } from '@/styles/tokens';

interface OriginBadgeProps {
  sourceId: string | null | undefined;
  /** Use the LOA's current status string. */
  status: string;
}

export default function OriginBadge({ sourceId, status }: OriginBadgeProps) {
  if (!sourceId) return null;

  const s = (status || '').toLowerCase();
  if (s === 'approved') return null;

  const isUnderReview = s.includes('review') || s.includes('functions');
  const tokens = isUnderReview ? originBadge.reviewPhase : originBadge.draftPhase;
  const verb = isUnderReview ? 'Based on' : 'Duplicated from';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 24,
        padding: '0 8px',
        borderRadius: 999,
        background: tokens.bg,
        color: tokens.text,
        border: `1px solid ${tokens.border}`,
        fontFamily: font.sans,
        fontSize: 12,
        lineHeight: '22px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      <span>{verb}</span>
      <span style={{ fontFamily: font.mono, fontWeight: 500 }}>{sourceId}</span>
    </span>
  );
}
