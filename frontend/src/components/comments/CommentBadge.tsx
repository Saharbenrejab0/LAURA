'use client';

/**
 * CommentBadge — small pill next to a field label showing unresolved
 * comment count. Click opens the comments rail focused on that field.
 *
 * Variants:
 *   - Has blocking → red bg
 *   - Has unresolved → gold bg
 *   - All resolved → gray bg
 *   - Zero comments → hidden
 */

import { color, font } from '@/styles/tokens';

interface CommentBadgeProps {
  count: number;
  hasBlocking?: boolean;
  allResolved?: boolean;
  onClick: () => void;
}

export default function CommentBadge({
  count, hasBlocking, allResolved, onClick,
}: CommentBadgeProps) {
  if (count === 0) return null;

  const style = hasBlocking
    ? { bg: '#FFF1EF', border: '#E6C1BD', text: '#A33A32' }
    : allResolved
    ? { bg: '#F0EEE8', border: '#E3DED5', text: '#6F675E' }
    : { bg: '#F7EFE2', border: '#E5CFAE', text: '#7A5522' };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`${count} comment${count > 1 ? 's' : ''}${hasBlocking ? ' (blocking)' : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 22, height: 22, borderRadius: 999,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        fontFamily: font.sans, fontSize: 11, fontWeight: 500,
        cursor: 'pointer', padding: '0 6px',
        lineHeight: '20px',
      }}
    >
      {count}
    </button>
  );
}
