'use client'

import { color } from '@/styles/tokens'
import type { LOARow } from '@/types/loa'
import { statusStyle } from '@/lib/workflow'
import { Icon, ic } from './shared'

const COLUMNS: { key: keyof LOARow; label: string; col: string; width: number; format?: (v: any) => string }[] = [
  { key: 'cot', label: 'COT', col: 'A', width: 130 },
  { key: 'customer', label: 'Customer', col: 'B', width: 140 },
  { key: 'vendor', label: 'Vendor', col: 'C', width: 260 },
  { key: 'fy_2025_total', label: 'FY 2025', col: 'D', width: 110, format: formatCurrency },
  { key: 'fy_2026_total', label: 'FY 2026 total', col: 'E', width: 120, format: formatCurrency },
  { key: 'avg_investment_per_door', label: 'Avg / door', col: 'F', width: 100, format: formatCurrency },
  { key: 'ppt_slide_required', label: 'PPT required', col: 'G', width: 120, format: (v) => (v ? 'YES' : 'NO') },
  { key: 'status', label: 'Status', col: 'H', width: 110 },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

export function ExcelTable({ rows, onOpenInExcel }: { rows: LOARow[]; onOpenInExcel?: () => void }) {
  return (
    <div style={{ background: color.bg.surface, borderRadius: 10, border: `1px solid ${color.border.soft}`, overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${color.border.soft}` }}>
        <div style={{ width: 24, height: 24, borderRadius: 4, background: '#217346', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
          X
        </div>
        <button
          onClick={onOpenInExcel}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'transparent', border: 'none' }}
        >
          <Icon d={ic.extLink} size={14} color={color.text.secondary} />
          <span style={{ fontSize: 12, color: color.text.secondary }}>Open in Excel</span>
        </button>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 42, padding: '8px 10px', borderBottom: `1px solid ${color.border.soft}`, background: color.bg.surface, position: 'sticky', left: 0, zIndex: 2 }} />
              {COLUMNS.map((col) => (
                <th
                  key={String(col.key)}
                  style={{
                    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 500,
                    color: color.text.tertiary, borderBottom: `1px solid ${color.border.soft}`,
                    background: color.bg.surface, whiteSpace: 'nowrap', minWidth: col.width,
                  }}
                >
                  <span style={{ color: color.text.tertiary, fontWeight: 600, marginRight: 8 }}>{col.col}</span>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? color.bg.subtle : 'transparent' }}>
                <td style={{ padding: '10px', textAlign: 'center', fontSize: 11, color: color.text.tertiary, fontWeight: 500, borderBottom: `1px solid ${color.border.soft}`, background: color.bg.surface, position: 'sticky', left: 0, zIndex: 1 }}>
                  {ri + 2}
                </td>
                {COLUMNS.map((col) => {
                  const raw = row[col.key]
                  const value = col.format ? col.format(raw) : (raw as React.ReactNode)
                  const isStatus = col.key === 'status'
                  const st = isStatus ? statusStyle(row.status) : null
                  return (
                    <td
                      key={String(col.key)}
                      style={{
                        padding: '10px 12px', fontSize: 13, color: color.text.primary,
                        borderBottom: `1px solid ${color.border.soft}`,
                        whiteSpace: col.key === 'vendor' ? 'normal' : 'nowrap',
                      }}
                    >
                      {isStatus && st ? (
                        <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      ) : (
                        value
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
