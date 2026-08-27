'use client';
import { useMemo, useState, useRef, useEffect } from 'react';
import type { LOA } from '@/types/loa';
import { ACTIVITY_TYPES, activityLabel } from '@/types/loa';
import type { ReviewVerdict, ReviewComment } from '@/types/review';
import { primaryCategory, formatEuro } from '@/types/review';
import { postComment } from '@/lib/review-api';
import { newestFirst } from '@/lib/sort';

// ── Ordering constants (mirrors deck generator) ───────────────────────────────
const CATEGORY_ORDER = ['Frames', 'Lenses', 'Wearables', 'Audio', 'Instruments', 'All cat.'];
// Canonical order comes from ACTIVITY_TYPES — one list, in reference_data order.
// This was a fourth hand-written copy in Title Case; once the data moved to
// UPPER_SNAKE codes it matched nothing and every activity ranked 999 (unsorted).
const ACTIVITY_ORDER: string[] = ACTIVITY_TYPES;
function catRank(c: string) { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? 999 : i; }
function actRank(a: string) { const i = ACTIVITY_ORDER.indexOf(a); return i === -1 ? 999 : i; }

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  gridLine:    'var(--border-strong)',
  headerBg:    'var(--surface-sunken)',
  groupBg:     'var(--border)',
  familyBg:    'var(--surface-sunken)',
  approved:    '#1A7348',
  rejected:    '#8A2E27',
  approvedTint:'rgba(26,115,72,0.07)',
  rejectedTint:'rgba(138,46,39,0.07)',
  gold:        '#B08D2F',
  ink:         'var(--text-primary)',
};

// ── Column definitions ────────────────────────────────────────────────────────
const COLS = [
  { key: 'num',     label: '#',              width: 40,  align: 'right'  as const, frozen: 'left'  as const },
  { key: 'sap',     label: 'SAP Code',       width: 108, align: 'left'   as const, frozen: 'left'  as const },
  { key: 'brand',   label: 'Brand / Topic',  width: 148, align: 'left'   as const, frozen: 'left'  as const },
  { key: 'type',    label: 'Activity Type',  width: 180, align: 'left'   as const },
  { key: 'desc',    label: 'Description',    width: 220, align: 'left'   as const },
  { key: 'scope',   label: 'Scope',          width: 100, align: 'left'   as const },
  { key: 'pax',     label: '# PAX',          width: 72,  align: 'right'  as const },
  { key: 'vendor',  label: 'Vendor',         width: 140, align: 'left'   as const },
  { key: 'budget',  label: 'Budget (€)',     width: 162, align: 'right'  as const },
  { key: 'quarter', label: 'Quarter',        width: 80,  align: 'center' as const },
  { key: 'region',  label: 'Region',         width: 100, align: 'left'   as const },
  { key: 'opex',    label: 'OPEX/CAPEX',     width: 96,  align: 'center' as const },
  // Wide enough for Approve + Reject + the comment button *and* its count badge.
  // At 200 the badge was clipped by the cell's overflow:hidden.
  { key: 'actions', label: 'Decision',       width: 248, align: 'center' as const, frozen: 'right' as const },
];

const FROZEN_LEFT_WIDTH  = COLS.filter(c => c.frozen === 'left').reduce((s, c) => s + c.width + 1, 0);
const FROZEN_RIGHT_WIDTH = COLS.filter(c => c.frozen === 'right').reduce((s, c) => s + c.width + 1, 0);

function leftOffset(colKey: string): number {
  let offset = 0;
  for (const c of COLS) {
    if (c.key === colKey) return offset;
    if (c.frozen === 'left') offset += c.width + 1;
  }
  return 0;
}

function statusBg(decision?: string) {
  if (decision === 'approved') return C.approvedTint;
  if (decision === 'rejected') return C.rejectedTint;
  return 'transparent';
}

/**
 * Background for a frozen (sticky) cell.
 *
 * Sticky cells sit *over* the columns that scroll under them, so they must be
 * opaque — `transparent` (an undecided row) let the OPEX/CAPEX badge and other
 * scrolled content bleed through and land on top of the Decision buttons.
 *
 * The status tint is an alpha wash, so it is painted as a gradient layer over an
 * opaque sheet white: same colour as a normal row, but nothing shows through.
 */
function frozenBg(decision?: string): React.CSSProperties {
  const tint = statusBg(decision);
  if (tint === 'transparent') return { backgroundColor: 'var(--surface)' };
  return { backgroundColor: 'var(--surface)', backgroundImage: `linear-gradient(${tint}, ${tint})` };
}

function statusBorder(decision?: string) {
  if (decision === 'approved') return `3px solid ${C.approved}`;
  if (decision === 'rejected') return `3px solid ${C.rejected}`;
  return '3px solid var(--border-strong)';
}

function quarterLabel(loa: LOA): string {
  const qs: string[] = [];
  if ((loa.q1_2026 || 0) > 0) qs.push('Q1');
  if ((loa.q2_2026 || 0) > 0) qs.push('Q2');
  if ((loa.q3_2026 || 0) > 0) qs.push('Q3');
  if ((loa.q4_2026 || 0) > 0) qs.push('Q4');
  return qs.join(', ') || '—';
}

// ── Shared cell style ─────────────────────────────────────────────────────────
function cellSx(col: typeof COLS[number], extra: React.CSSProperties = {}): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '0 8px',
    borderRight: `1px solid ${C.gridLine}`,
    borderBottom: `1px solid ${C.gridLine}`,
    width: col.width,
    minWidth: col.width,
    maxWidth: col.width,
    textAlign: col.align,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12.5,
    boxSizing: 'border-box',
    background: 'inherit',
    verticalAlign: 'middle',
  };
  if (col.frozen === 'left') {
    Object.assign(base, { position: 'sticky', left: leftOffset(col.key), zIndex: 3 });
    if (col.key === 'num') base.borderLeft = `3px solid ${C.gridLine}`;
  }
  if (col.frozen === 'right') {
    Object.assign(base, { position: 'sticky', right: 0, zIndex: 3, borderLeft: `2px solid ${C.gridLine}` });
    // The decision cell holds buttons, not text, and one of them carries an
    // outside-corner count badge — clipping it is what made the column look broken.
    if (col.key === 'actions') Object.assign(base, { overflow: 'visible', textOverflow: 'clip' });
  }
  return { ...base, ...extra };
}

/**
 * Tick and cross as inline SVG rather than ✓ / ✗ characters. Those two
 * codepoints are missing from several of the fonts this app falls back to, and a
 * missing glyph rendered with a zero advance width lands on top of the label.
 */
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
      <path d="M2 6.4 4.6 9 10 3.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface GridGroup {
  category: string;
  count: number;
  budget: number;
  families: {
    activity: string;
    count: number;
    budget: number;
    loas: LOA[];
  }[];
}

interface Props {
  loas: LOA[];
  verdicts: Record<string, ReviewVerdict>;
  comments: ReviewComment[];
  isSubmitted: boolean;
  collapsedCategories: Set<string>;
  collapsedFamilies: Set<string>;
  onToggleCategory: (cat: string) => void;
  onToggleFamily: (key: string) => void;
  onApprove: (loa: LOA) => void;
  onReject: (loa: LOA) => void;
  onComment: (loa: LOA) => void;
  /** When set, the Decision column switches to an inline comment thread panel. */
  commentLoaId?: string | null;
  cycleId?: string | null;
  onCommentAdded?: (comment: ReviewComment) => void;
  onCloseComments?: () => void;
}

export default function LOALinesGrid({
  loas, verdicts, comments, isSubmitted,
  collapsedCategories, collapsedFamilies,
  onToggleCategory, onToggleFamily,
  onApprove, onReject, onComment,
  commentLoaId, cycleId, onCommentAdded, onCloseComments,
}: Props) {
  const commentMode = !!commentLoaId;
  // Build hierarchy
  const groups: GridGroup[] = useMemo(() => {
    const catMap = new Map<string, Map<string, LOA[]>>();
    for (const loa of loas) {
      const cat = primaryCategory(loa);
      if (!catMap.has(cat)) catMap.set(cat, new Map());
      const actMap = catMap.get(cat)!;
      const act = loa.activity_type || 'Other';
      if (!actMap.has(act)) actMap.set(act, []);
      actMap.get(act)!.push(loa);
    }
    return [...catMap.keys()]
      .sort((a, b) => catRank(a) - catRank(b))
      .map(category => {
        const actMap = catMap.get(category)!;
        const families = [...actMap.keys()]
          .sort((a, b) => actRank(a) - actRank(b))
          .map(activity => {
            // Rows newest-first (shared rule). Category/activity group order
            // still follows catRank/actRank — the client's reporting order.
            const actLoas = newestFirst(actMap.get(activity)!);
            return {
              activity,
              count: actLoas.length,
              budget: actLoas.reduce((s, l) => s + (l.fy_2026_total || 0), 0),
              loas: actLoas,
            };
          });
        return {
          category,
          count: families.reduce((s, f) => s + f.count, 0),
          budget: families.reduce((s, f) => s + f.budget, 0),
          families,
        };
      });
  }, [loas]);

  const totalCols = COLS.length;
  let rowIndex = 0;

  // Active LOA for the comment panel
  const activeCommentLoa = commentLoaId ? loas.find(l => l.id === commentLoaId) : null;

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', overflow: 'hidden' }}>

      {/* ── Scrollable table area ── */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', position: 'relative' }}>
      <table style={{
        borderCollapse: 'separate',
        borderSpacing: 0,
        tableLayout: 'fixed',
        minWidth: COLS.reduce((s, c) => s + c.width + 1, 0),
        width: '100%',
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}>
        <colgroup>
          {COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}
        </colgroup>

        {/* ── Sticky header ── */}
        <thead>
          <tr style={{ background: C.headerBg, height: 36 }}>
            {COLS.map((col, ci) => {
              const isCornerLeft  = col.frozen === 'left';
              const isCornerRight = col.frozen === 'right';
              const sx: React.CSSProperties = {
                ...cellSx(col),
                ...(col.frozen ? { backgroundColor: C.headerBg } : null),
                position: 'sticky',
                top: 0,
                zIndex: isCornerLeft || isCornerRight ? 4 : 3,
                background: C.headerBg,
                fontSize: 11,
                fontWeight: 700,
                color: commentMode && col.key === 'actions' ? C.gold : 'var(--text-secondary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                height: 36,
                borderBottom: `2px solid ${C.gridLine}`,
              };
              if (col.key === 'num') sx.borderLeft = `3px solid ${C.gridLine}`;
              const label = commentMode && col.key === 'actions' ? 'COMMENTS' : col.label;
              return <th key={col.key} style={sx}>{label}</th>;
            })}
          </tr>
        </thead>

        <tbody>
          {groups.map(group => {
            const catCollapsed = collapsedCategories.has(group.category);
            return (
              <>
                {/* Category group header */}
                <tr key={`cat-${group.category}`} style={{ background: C.groupBg, height: 34, cursor: 'pointer' }} onClick={() => onToggleCategory(group.category)}>
                  <td colSpan={totalCols} style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    background: C.groupBg,
                    padding: '0 12px',
                    borderBottom: `1px solid ${C.gridLine}`,
                    borderLeft: `3px solid ${C.gridLine}`,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: C.ink,
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{ marginRight: 8, fontSize: 10, display: 'inline-block', transform: catCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 150ms' }}>▼</span>
                    {group.category.toUpperCase()}
                    <span style={{ marginLeft: 10, fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 12 }}>
                      {group.count} LOA{group.count !== 1 ? 's' : ''} · {formatEuro(group.budget)}
                    </span>
                  </td>
                </tr>

                {!catCollapsed && group.families.map(family => {
                  const famKey = `${group.category}::${family.activity}`;
                  const famCollapsed = collapsedFamilies.has(famKey);
                  return (
                    <>
                      {/* Family sub-header */}
                      <tr key={`fam-${famKey}`} style={{ background: C.familyBg, height: 30, cursor: 'pointer' }} onClick={() => onToggleFamily(famKey)}>
                        <td colSpan={totalCols} style={{
                          position: 'sticky', left: 0, zIndex: 2,
                          background: C.familyBg,
                          padding: '0 12px 0 28px',
                          borderBottom: `1px solid ${C.gridLine}`,
                          borderLeft: `3px solid ${C.gridLine}`,
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                        }}>
                          <span style={{ marginRight: 6, fontSize: 9, display: 'inline-block', transform: famCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 150ms' }}>▼</span>
                          {family.activity}
                          <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-faint)', fontSize: 11.5 }}>
                            {family.count} · {formatEuro(family.budget)}
                          </span>
                        </td>
                      </tr>

                      {/* LOA rows */}
                      {!famCollapsed && family.loas.map(loa => {
                        rowIndex += 1;
                        const idx   = rowIndex;
                        const verdict = verdicts[loa.id];
                        const decision = verdict?.decision;
                        const loaCommentCount = comments.filter(c => c.slideId === loa.id).length;
                        const rowBg = statusBg(decision);
                        const leftBorder = statusBorder(decision);

                        return (
                          <tr key={loa.id} style={{ height: 34, background: rowBg }}>
                            {COLS.map(col => {
                              let content: React.ReactNode = null;
                              const sx = cellSx(
                                col,
                                col.frozen ? frozenBg(decision) : { background: rowBg },
                              );
                              if (col.key === 'num') {
                                sx.borderLeft = leftBorder;
                                content = <span style={{ color: 'var(--text-faint)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{idx}</span>;
                              } else if (col.key === 'sap') {
                                content = <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{loa.sap_event_code || '—'}</span>;
                              } else if (col.key === 'brand') {
                                content = <span style={{ fontWeight: 600, color: C.ink }}>{loa.brand || '—'}</span>;
                              } else if (col.key === 'type') {
                                content = activityLabel(loa.activity_type) || '—';
                              } else if (col.key === 'desc') {
                                content = (
                                  <span title={loa.detail || loa.description || ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {loa.detail || loa.description || '—'}
                                  </span>
                                );
                              } else if (col.key === 'scope') {
                                content = loa.event_purpose || loa.adv_selling || '—';
                              } else if (col.key === 'pax') {
                                content = loa.num_customers != null
                                  ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{loa.num_customers.toLocaleString('en')}</span>
                                  : '—';
                              } else if (col.key === 'vendor') {
                                content = loa.vendor || '—';
                              } else if (col.key === 'budget') {
                                content = (
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums', color: C.ink, fontWeight: 600 }}>
                                    {formatEuro(loa.fy_2026_total)}
                                  </span>
                                );
                              } else if (col.key === 'quarter') {
                                content = <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{quarterLabel(loa)}</span>;
                              } else if (col.key === 'region') {
                                content = loa.cluster || loa.country || '—';
                              } else if (col.key === 'opex') {
                                content = (
                                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: loa.capex_opex === 'CapEx' ? '#EEF4FF' : '#F0FAF4', color: loa.capex_opex === 'CapEx' ? '#1D4ED8' : '#166534', fontWeight: 600 }}>
                                    {loa.capex_opex || '—'}
                                  </span>
                                );
                              } else if (col.key === 'actions') {
                                const isActiveThread = commentLoaId === loa.id;
                                if (commentMode) {
                                  // In comment mode: only the chat icon; clicking switches the active thread
                                  content = (
                                    <button
                                      onClick={() => onComment(loa)}
                                      title={loaCommentCount > 0 ? `${loaCommentCount} comment${loaCommentCount !== 1 ? 's' : ''}` : 'Open comments'}
                                      style={{
                                        width: 28, height: 28, borderRadius: 6,
                                        border: isActiveThread ? `1.5px solid ${C.gold}` : '1.5px solid var(--border-strong)',
                                        background: isActiveThread ? '#FBF7ED' : 'transparent',
                                        color: isActiveThread ? C.gold : loaCommentCount > 0 ? C.gold : 'var(--text-faint)',
                                        fontSize: 13, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        position: 'relative', flexShrink: 0,
                                      }}
                                    >
                                      💬
                                      {loaCommentCount > 0 && (
                                        <span style={{
                                          position: 'absolute', top: -5, right: -5,
                                          width: 14, height: 14, borderRadius: 7,
                                          background: C.gold, color: 'var(--surface)',
                                          fontSize: 8.5, fontWeight: 700,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                          {loaCommentCount}
                                        </span>
                                      )}
                                    </button>
                                  );
                                } else {
                                content = (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                    {isSubmitted ? (
                                      <span style={{
                                        display: 'inline-block',
                                        padding: '2px 10px',
                                        borderRadius: 12,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: decision === 'approved' ? '#E8F5EE' : decision === 'rejected' ? '#FDF0EE' : 'var(--surface-sunken)',
                                        color: decision === 'approved' ? C.approved : decision === 'rejected' ? C.rejected : 'var(--text-tertiary)',
                                      }}>
                                        {decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Unreviewed'}
                                      </span>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => onApprove(loa)}
                                          title="Approve"
                                          style={{
                                            height: 26,
                                            padding: '0 10px',
                                            borderRadius: 6,
                                            border: decision === 'approved' ? `1.5px solid ${C.approved}` : '1.5px solid #C8E6D4',
                                            background: decision === 'approved' ? C.approved : 'transparent',
                                            color: decision === 'approved' ? 'var(--surface)' : C.approved,
                                            fontSize: 11.5,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 120ms',
                                            whiteSpace: 'nowrap',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                          }}
                                        >
                                          <CheckIcon />Approve
                                        </button>
                                        <button
                                          onClick={() => onReject(loa)}
                                          title="Reject"
                                          style={{
                                            height: 26,
                                            padding: '0 10px',
                                            borderRadius: 6,
                                            border: decision === 'rejected' ? `1.5px solid ${C.rejected}` : '1.5px solid #F0C4BE',
                                            background: decision === 'rejected' ? C.rejected : 'transparent',
                                            color: decision === 'rejected' ? 'var(--surface)' : C.rejected,
                                            fontSize: 11.5,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 120ms',
                                            whiteSpace: 'nowrap',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                          }}
                                        >
                                          <CrossIcon />Reject
                                        </button>
                                        <button
                                          onClick={() => onComment(loa)}
                                          title={loaCommentCount > 0 ? `${loaCommentCount} comment${loaCommentCount !== 1 ? 's' : ''}` : 'Add comment'}
                                          style={{
                                            width: 26,
                                            height: 26,
                                            borderRadius: 6,
                                            border: '1.5px solid var(--border-strong)',
                                            background: loaCommentCount > 0 ? '#FBF7ED' : 'transparent',
                                            color: loaCommentCount > 0 ? C.gold : 'var(--text-faint)',
                                            fontSize: 13,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative',
                                            flexShrink: 0,
                                          }}
                                        >
                                          💬
                                          {loaCommentCount > 0 && (
                                            <span style={{
                                              position: 'absolute',
                                              top: -5,
                                              right: -5,
                                              width: 14,
                                              height: 14,
                                              borderRadius: 7,
                                              background: C.gold,
                                              color: 'var(--surface)',
                                              fontSize: 8.5,
                                              fontWeight: 700,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                            }}>
                                              {loaCommentCount}
                                            </span>
                                          )}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                );
                                } // end commentMode else
                              }

                              return <td key={col.key} style={sx}>{content}</td>;
                            })}
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </>
            );
          })}

          {loas.length === 0 && (
            <tr>
              <td colSpan={totalCols} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-faint)', fontSize: 14, borderBottom: `1px solid ${C.gridLine}` }}>
                No LOAs match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>{/* end scroll area */}

      {/* ── Comment column panel ── */}
      {commentMode && (
        <CommentColumnPanel
          loaId={commentLoaId!}
          loaLabel={activeCommentLoa ? (activeCommentLoa.brand || activeCommentLoa.sap_event_code || commentLoaId!) : commentLoaId!}
          cycleId={cycleId || ''}
          comments={comments}
          onCommentAdded={onCommentAdded}
          onClose={onCloseComments}
        />
      )}
    </div>
  );
}

// ── Comment column panel ─────────────────────────────────────────────────────

interface PanelProps {
  loaId: string;
  loaLabel: string;
  cycleId: string;
  comments: ReviewComment[];
  onCommentAdded?: (c: ReviewComment) => void;
  onClose?: () => void;
}

function CommentColumnPanel({ loaId, loaLabel, cycleId, comments, onCommentAdded, onClose }: PanelProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loaComments = comments.filter(c => c.slideId === loaId);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [loaComments.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loaId]);

  const handleSend = async () => {
    if (!text.trim() || sending || !cycleId) return;
    setSending(true);
    try {
      const comment = await postComment(cycleId, loaId, text.trim());
      onCommentAdded?.(comment);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      width: 249, flexShrink: 0,
      borderLeft: `2px solid ${C.gridLine}`,
      // height:100% + minHeight:0 pins this panel to the grid's height, so the
      // thread scrolls internally and the composer stays on the row you are
      // looking at. Without them the panel grew with the thread and the input
      // ended up below the fold, needing a full-page scroll to reach.
      height: '100%', minHeight: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--surface)', fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      {/* Header — 36px to match the sticky table header */}
      <div style={{
        height: 36, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px 0 12px',
        background: C.headerBg,
        borderBottom: `2px solid ${C.gridLine}`,
        position: 'sticky', top: 0, zIndex: 4,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loaLabel}
        </span>
        <button
          onClick={onClose}
          title="Close comments"
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-faint)', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
        >
          ×
        </button>
      </div>

      {/* Thread */}
      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loaComments.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0, textAlign: 'center', padding: '20px 0' }}>No comments yet.</p>
        ) : loaComments.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <div style={{ width: 26, height: 26, borderRadius: 13, background: C.gold, color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>
              {(c.authorName || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>{c.authorName}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45, wordBreak: 'break-word' }}>{c.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px 10px', borderTop: `1px solid ${C.gridLine}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Add a comment…"
            style={{ flex: 1, borderRadius: 6, border: `1.5px solid ${C.gridLine}`, padding: '5px 8px', fontSize: 12.5, outline: 'none', fontFamily: 'inherit', transition: 'border-color 150ms' }}
            onFocus={e => { e.target.style.borderColor = C.gold; }}
            onBlur={e => { e.target.style.borderColor = C.gridLine; }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            style={{ height: 30, padding: '0 10px', borderRadius: 6, border: 'none', background: text.trim() ? C.gold : 'var(--border)', color: text.trim() ? 'var(--surface)' : 'var(--text-faint)', fontSize: 11.5, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'background 150ms' }}
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
