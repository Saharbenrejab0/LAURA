'use client';
import { useMemo, useState } from 'react';
import type { LOA } from '@/types/loa';
import type { ReviewVerdict, ReviewComment } from '@/types/review';
import { primaryCategory } from '@/types/review';
import { ACTIVITY_TYPES } from '@/types/loa'

const CATEGORY_ORDER = ['Frames', 'Lenses', 'Wearables', 'Audio', 'Instruments', 'All cat.'];
// Canonical order comes from ACTIVITY_TYPES — one list, in reference_data order.
// This was a fourth hand-written copy in Title Case; once the data moved to
// UPPER_SNAKE codes it matched nothing and every activity ranked 999 (unsorted).
const ACTIVITY_ORDER: string[] = ACTIVITY_TYPES;

function catRank(c: string) { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? 999 : i; }
function actRank(a: string) { const i = ACTIVITY_ORDER.indexOf(a); return i === -1 ? 999 : i; }

const QUARTERS: { key: 'q1_2026' | 'q2_2026' | 'q3_2026' | 'q4_2026'; label: string }[] = [
  { key: 'q1_2026', label: 'Q1' },
  { key: 'q2_2026', label: 'Q2' },
  { key: 'q3_2026', label: 'Q3' },
  { key: 'q4_2026', label: 'Q4' },
];

const C = {
  gridLine:  '#D9D5CD',
  headerBg:  '#F4F3F0',
  groupBg:   '#ECEAE4',
  totalBg:   '#1a1a1a',
  capexBg:   '#EEF4FF',
  gold:      '#B08D2F',
  rejected:  '#8A2E27',
  approved:  '#1A7348',
  ink:       '#1a1a1a',
};

function fmt000(n: number): string {
  if (!n || n === 0) return '';
  const k = Math.round(n / 1000);
  if (k === 0) return '';
  return k.toLocaleString('de-DE');
}

interface PivotRow {
  key: string;
  label: string;
  indent: number;
  isCategory: boolean;
  isTotal: boolean;
  isCapex: boolean;
  cells: Record<string, Record<string, number>>;  // [region][quarter] = budget
  loaMap: Record<string, Record<string, LOA[]>>;   // [region][quarter] = loas
}

interface Props {
  loas: LOA[];
  verdicts: Record<string, ReviewVerdict>;
  comments: ReviewComment[];
  isSubmitted: boolean;
  onBulkReject: (loas: LOA[], groupLabel: string) => void;
  onComment: (loaId: string, at: DOMRect) => void;
}

interface ContextMenu {
  x: number;
  y: number;
  loas: LOA[];
  label: string;
}

export default function SummaryPivot({ loas, verdicts, comments, isSubmitted, onBulkReject, onComment }: Props) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  // ── Extract unique regions from data ─────────────────────────────────────
  const regions = useMemo(() => {
    const seen = new Set<string>();
    for (const loa of loas) {
      const r = loa.cluster || loa.country || 'Unknown';
      seen.add(r);
    }
    return [...seen].sort();
  }, [loas]);

  // ── Build pivot data ──────────────────────────────────────────────────────
  const { opexRows, capexRows } = useMemo(() => {
    // Category → Activity → Region → Quarter → { budget, loas[] }
    type Acc = Record<string, Record<string, Record<string, Record<string, { budget: number; loas: LOA[] }>>>> ;
    const opex: Acc = {};
    const capex: Acc = {};

    for (const loa of loas) {
      const cat = primaryCategory(loa);
      const act = loa.activity_type || 'Other';
      const reg = loa.cluster || loa.country || 'Unknown';
      const acc = (loa.capex_opex === 'CapEx') ? capex : opex;

      if (!acc[cat]) acc[cat] = {};
      if (!acc[cat][act]) acc[cat][act] = {};
      if (!acc[cat][act][reg]) acc[cat][act][reg] = {};

      for (const q of QUARTERS) {
        const v = loa[q.key] || 0;
        if (v > 0) {
          if (!acc[cat][act][reg][q.label]) acc[cat][act][reg][q.label] = { budget: 0, loas: [] };
          acc[cat][act][reg][q.label].budget += v;
          acc[cat][act][reg][q.label].loas.push(loa);
        }
      }
    }

    function buildRows(acc: Acc): PivotRow[] {
      const rows: PivotRow[] = [];
      const cats = Object.keys(acc).sort((a, b) => catRank(a) - catRank(b));
      for (const cat of cats) {
        const catCells: Record<string, Record<string, number>> = {};
        const catLoaMap: Record<string, Record<string, LOA[]>> = {};
        const actMap = acc[cat];
        const activities = Object.keys(actMap).sort((a, b) => actRank(a) - actRank(b));

        const activityRows: PivotRow[] = [];
        for (const act of activities) {
          const regMap = actMap[act];
          const cells: Record<string, Record<string, number>> = {};
          const loaMap: Record<string, Record<string, LOA[]>> = {};
          for (const reg of regions) {
            cells[reg] = {};
            loaMap[reg] = {};
            for (const q of QUARTERS) {
              const entry = regMap[reg]?.[q.label];
              if (entry && entry.budget > 0) {
                cells[reg][q.label] = entry.budget;
                loaMap[reg][q.label] = entry.loas;
                if (!catCells[reg]) catCells[reg] = {};
                if (!catLoaMap[reg]) catLoaMap[reg] = {};
                catCells[reg][q.label] = (catCells[reg][q.label] || 0) + entry.budget;
                if (!catLoaMap[reg][q.label]) catLoaMap[reg][q.label] = [];
                catLoaMap[reg][q.label].push(...entry.loas);
              }
            }
          }
          activityRows.push({ key: `${cat}::${act}`, label: act, indent: 1, isCategory: false, isTotal: false, isCapex: false, cells, loaMap });
        }

        rows.push({ key: `cat::${cat}`, label: cat, indent: 0, isCategory: true, isTotal: false, isCapex: false, cells: catCells, loaMap: catLoaMap });
        rows.push(...activityRows);
      }
      return rows;
    }

    return { opexRows: buildRows(opex), capexRows: buildRows(capex) };
  }, [loas, regions]);

  // ── Grand totals ───────────────────────────────────────────────────────────
  const grandTotalRow = useMemo((): PivotRow => {
    const cells: Record<string, Record<string, number>> = {};
    const loaMap: Record<string, Record<string, LOA[]>> = {};
    for (const row of opexRows) {
      if (row.isCategory) {
        for (const reg of regions) {
          if (!cells[reg]) cells[reg] = {};
          if (!loaMap[reg]) loaMap[reg] = {};
          for (const q of QUARTERS) {
            if (row.cells[reg]?.[q.label]) {
              cells[reg][q.label] = (cells[reg][q.label] || 0) + row.cells[reg][q.label];
              if (!loaMap[reg][q.label]) loaMap[reg][q.label] = [];
              loaMap[reg][q.label].push(...(row.loaMap[reg]?.[q.label] || []));
            }
          }
        }
      }
    }
    return { key: 'grand-total', label: 'Grand Total OPEX', indent: 0, isCategory: false, isTotal: true, isCapex: false, cells, loaMap };
  }, [opexRows, regions]);

  const capexTotalRow = useMemo((): PivotRow => {
    const cells: Record<string, Record<string, number>> = {};
    const loaMap: Record<string, Record<string, LOA[]>> = {};
    for (const row of capexRows) {
      if (row.isCategory) {
        for (const reg of regions) {
          if (!cells[reg]) cells[reg] = {};
          if (!loaMap[reg]) loaMap[reg] = {};
          for (const q of QUARTERS) {
            if (row.cells[reg]?.[q.label]) {
              cells[reg][q.label] = (cells[reg][q.label] || 0) + row.cells[reg][q.label];
              if (!loaMap[reg][q.label]) loaMap[reg][q.label] = [];
              loaMap[reg][q.label].push(...(row.loaMap[reg]?.[q.label] || []));
            }
          }
        }
      }
    }
    return { key: 'capex-total', label: 'Total CapEx', indent: 0, isCategory: false, isTotal: false, isCapex: true, cells, loaMap };
  }, [capexRows, regions]);

  function rowTotal(row: PivotRow): number {
    let t = 0;
    for (const reg of regions) {
      for (const q of QUARTERS) {
        t += row.cells[reg]?.[q.label] || 0;
      }
    }
    return t;
  }

  function regionTotal(row: PivotRow, reg: string): number {
    return QUARTERS.reduce((s, q) => s + (row.cells[reg]?.[q.label] || 0), 0);
  }

  function renderRow(row: PivotRow, idx: number) {
    const isCatCollapsed = collapsedCategories.has(row.key);
    const isActivity = !row.isCategory && !row.isTotal && !row.isCapex;
    const rowBg = row.isTotal ? C.totalBg : row.isCapex ? C.capexBg : row.isCategory ? C.groupBg : '#fff';
    const textColor = row.isTotal ? '#fff' : '#1a1a1a';
    const fontWeight = row.isCategory || row.isTotal || row.isCapex ? 700 : 400;

    return (
      <tr
        key={row.key}
        style={{ background: rowBg, height: 30 }}
        onClick={() => {
          if (row.isCategory) {
            setCollapsedCategories(prev => {
              const next = new Set(prev);
              next.has(row.key) ? next.delete(row.key) : next.add(row.key);
              return next;
            });
          }
        }}
      >
        {/* Row label — sticky left */}
        <td style={{
          position: 'sticky', left: 0, zIndex: 2,
          background: rowBg,
          padding: `0 10px 0 ${10 + row.indent * 20}px`,
          borderRight: `2px solid ${C.gridLine}`,
          borderBottom: `1px solid ${row.isTotal ? 'rgba(255,255,255,0.1)' : C.gridLine}`,
          fontSize: row.isCategory ? 12 : 12.5,
          fontWeight,
          color: textColor,
          whiteSpace: 'nowrap',
          minWidth: 200,
          width: 200,
          cursor: row.isCategory ? 'pointer' : 'default',
          userSelect: 'none',
        }}>
          {row.isCategory && (
            <span style={{ marginRight: 6, fontSize: 9, display: 'inline-block', transform: isCatCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 150ms' }}>▼</span>
          )}
          {row.label.toUpperCase()}
        </td>

        {/* Region × Quarter cells */}
        {regions.map(reg => (
          <>
            {QUARTERS.map(q => {
              const val = row.cells[reg]?.[q.label] || 0;
              const cellLoas = row.loaMap[reg]?.[q.label] || [];
              const hasComment = cellLoas.some(l => comments.some(c => c.slideId === l.id));
              const allRejected = cellLoas.length > 0 && cellLoas.every(l => verdicts[l.id]?.decision === 'rejected');

              return (
                <td
                  key={`${reg}-${q.label}`}
                  onContextMenu={e => {
                    if (cellLoas.length > 0 && !isSubmitted) {
                      e.preventDefault();
                      const label = `${row.label} · ${reg} · ${q.label}`;
                      setContextMenu({ x: e.clientX, y: e.clientY, loas: cellLoas, label });
                    }
                  }}
                  style={{
                    textAlign: 'right',
                    padding: '0 8px',
                    borderRight: `1px solid ${row.isTotal ? 'rgba(255,255,255,0.1)' : C.gridLine}`,
                    borderBottom: `1px solid ${row.isTotal ? 'rgba(255,255,255,0.1)' : C.gridLine}`,
                    fontSize: 12.5,
                    fontWeight,
                    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
                    fontVariantNumeric: 'tabular-nums',
                    color: allRejected ? C.rejected : textColor,
                    background: rowBg,
                    position: 'relative',
                    cursor: cellLoas.length > 0 && !isSubmitted ? 'context-menu' : 'default',
                  }}
                >
                  {val > 0 && fmt000(val)}
                  {hasComment && val > 0 && (
                    <span style={{
                      position: 'absolute', top: 1, right: 1,
                      width: 0, height: 0,
                      borderStyle: 'solid',
                      borderWidth: '0 6px 6px 0',
                      borderColor: `transparent ${C.rejected} transparent transparent`,
                    }} />
                  )}
                </td>
              );
            })}
            {/* Region subtotal */}
            <td style={{
              textAlign: 'right',
              padding: '0 8px',
              borderRight: `2px solid ${C.gridLine}`,
              borderBottom: `1px solid ${C.gridLine}`,
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
              fontVariantNumeric: 'tabular-nums',
              color: row.isTotal ? '#fff' : '#555',
              background: rowBg,
            }}>
              {regionTotal(row, reg) > 0 && fmt000(regionTotal(row, reg))}
            </td>
          </>
        ))}

        {/* Grand total */}
        <td style={{
          position: 'sticky', right: 0, zIndex: 2,
          textAlign: 'right',
          padding: '0 12px',
          borderBottom: `1px solid ${C.gridLine}`,
          borderLeft: `2px solid ${C.gridLine}`,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
          fontVariantNumeric: 'tabular-nums',
          color: row.isTotal ? '#fff' : C.ink,
          background: rowBg,
          minWidth: 100,
          width: 100,
        }}>
          {rowTotal(row) > 0 && fmt000(rowTotal(row))}
        </td>
      </tr>
    );
  }

  // Flatten rows, handling collapsed categories
  const allRows: PivotRow[] = [];
  let i = 0;
  while (i < opexRows.length) {
    const row = opexRows[i];
    allRows.push(row);
    if (row.isCategory && collapsedCategories.has(row.key)) {
      // Skip activity rows for this category
      i++;
      while (i < opexRows.length && !opexRows[i].isCategory) i++;
    } else {
      i++;
    }
  }
  allRows.push(grandTotalRow);
  if (capexRows.length > 0) allRows.push(capexTotalRow);

  const totalHeaderCols = regions.length * (QUARTERS.length + 1) + 1; // +1 for region total, +1 for grand total

  return (
    <div
      style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative' }}
      onClick={() => setContextMenu(null)}
    >
      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1px solid #D9D5CD',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            padding: '4px 0',
            zIndex: 300,
            minWidth: 220,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '6px 14px 4px', fontSize: 11, color: '#999', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {contextMenu.loas.length} LOA{contextMenu.loas.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={() => { onBulkReject(contextMenu.loas, contextMenu.label); setContextMenu(null); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: 'none', fontSize: 13.5, color: C.rejected, fontWeight: 600, cursor: 'pointer' }}
          >
            ✗ Reject LOAs in this group
          </button>
        </div>
      )}

      <table style={{
        borderCollapse: 'separate',
        borderSpacing: 0,
        tableLayout: 'auto',
        fontFamily: 'system-ui,-apple-system,sans-serif',
        minWidth: 200 + regions.length * (QUARTERS.length + 1) * 70 + 100,
      }}>
        {/* ── Sticky header ── */}
        <thead>
          {/* Region row */}
          <tr style={{ background: C.headerBg, height: 30 }}>
            <th rowSpan={2} style={{
              position: 'sticky', top: 0, left: 0, zIndex: 5,
              background: C.headerBg, borderRight: `2px solid ${C.gridLine}`,
              borderBottom: `2px solid ${C.gridLine}`, fontSize: 11,
              fontWeight: 700, color: '#666', letterSpacing: '0.04em',
              textTransform: 'uppercase', padding: '0 10px', textAlign: 'left',
              minWidth: 200, width: 200, whiteSpace: 'nowrap',
            }}>
              Category / Activity <span style={{ color: '#bbb', fontSize: 10 }}>(€ 000)</span>
            </th>
            {regions.map(reg => (
              <th
                key={reg}
                colSpan={QUARTERS.length + 1}
                style={{
                  background: C.headerBg, position: 'sticky', top: 0, zIndex: 4,
                  textAlign: 'center', padding: '0 4px',
                  borderRight: `2px solid ${C.gridLine}`,
                  borderBottom: `1px solid ${C.gridLine}`,
                  fontSize: 11, fontWeight: 700, color: '#333',
                  letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}
              >
                {reg}
              </th>
            ))}
            <th rowSpan={2} style={{
              position: 'sticky', top: 0, right: 0, zIndex: 5,
              background: C.groupBg, borderLeft: `2px solid ${C.gridLine}`,
              borderBottom: `2px solid ${C.gridLine}`, fontSize: 11,
              fontWeight: 700, color: '#333', textAlign: 'right',
              padding: '0 12px', minWidth: 100, width: 100, whiteSpace: 'nowrap',
            }}>
              TOTAL
            </th>
          </tr>
          {/* Quarter row */}
          <tr style={{ background: C.headerBg, height: 26 }}>
            {regions.map(reg => (
              <>
                {QUARTERS.map(q => (
                  <th
                    key={`${reg}-${q.label}`}
                    style={{
                      background: C.headerBg, position: 'sticky', top: 30, zIndex: 3,
                      textAlign: 'right', padding: '0 8px',
                      borderRight: `1px solid ${C.gridLine}`,
                      borderBottom: `2px solid ${C.gridLine}`,
                      fontSize: 10.5, fontWeight: 600, color: '#999',
                      letterSpacing: '0.03em', minWidth: 60, whiteSpace: 'nowrap',
                    }}
                  >
                    {q.label}
                  </th>
                ))}
                <th style={{
                  background: C.groupBg, position: 'sticky', top: 30, zIndex: 3,
                  textAlign: 'right', padding: '0 8px',
                  borderRight: `2px solid ${C.gridLine}`,
                  borderBottom: `2px solid ${C.gridLine}`,
                  fontSize: 10.5, fontWeight: 700, color: '#555', minWidth: 68,
                }}>
                  SUB
                </th>
              </>
            ))}
          </tr>
        </thead>

        <tbody>
          {allRows.map((row, idx) => renderRow(row, idx))}

          {loas.length === 0 && (
            <tr>
              <td colSpan={1 + regions.length * (QUARTERS.length + 1) + 1}
                style={{ textAlign: 'center', padding: '48px 24px', color: '#bbb', fontSize: 14 }}>
                No LOA data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
