/**
 * LAURA — Excel column definitions (single source of truth).
 *
 * Mirrors backend/engines/excel.py HEADERS exactly — same 39 columns, same
 * order, same labels — so the on-screen Excel row and the downloaded .xlsx
 * never drift apart. If excel.py changes, change this too (and vice versa).
 *
 * Each column: { header, field, fmt }.
 *   field → key on the frontend LOA object returned by getLOA()
 *   fmt   → how to display the value
 *
 * NOTE: a few backend columns (cost split %, forecasts, finance validator)
 * are not present on the current frontend LOA type. They're kept in the list
 * (so the row matches the export's shape) and render "—" until the API
 * returns them. Marked with `backendOnly: true`.
 */

export type ExcelFmt = 'text' | 'money' | 'int' | 'percent' | 'date' | 'ppt'

export interface ExcelColumn {
  header: string
  field: string
  fmt: ExcelFmt
  backendOnly?: boolean
}

export const EXCEL_COLUMNS: ExcelColumn[] = [
  // ── Before quarters (14) ──
  { header: 'Cluster', field: 'cluster', fmt: 'text' },
  { header: 'Country', field: 'country', fmt: 'text' },
  { header: 'Legal Entity', field: 'legal_entity', fmt: 'text' },
  { header: 'Type/Planning 2.0', field: 'activity_type', fmt: 'text' },
  { header: 'Category', field: 'category', fmt: 'text' },
  { header: 'Brand', field: 'brand', fmt: 'text' },
  { header: 'COT', field: 'cot', fmt: 'text' },
  { header: 'Customer', field: 'customer', fmt: 'text' },
  { header: 'Vendor', field: 'vendor', fmt: 'text' },
  { header: 'Detail', field: 'detail', fmt: 'text' },
  { header: '# Doors', field: 'num_doors', fmt: 'int' },
  { header: '# Customers', field: 'num_customers', fmt: 'int' },
  { header: 'Avg Investment/Door', field: 'avg_investment_per_door', fmt: 'money' },
  { header: 'Currency', field: 'currency', fmt: 'text' },

  // ── Quarters (5) + FY total ──
  { header: 'Q4-25', field: 'q4_2025', fmt: 'money' },
  { header: 'Q1-26', field: 'q1_2026', fmt: 'money' },
  { header: 'Q2-26', field: 'q2_2026', fmt: 'money' },
  { header: 'Q3-26', field: 'q3_2026', fmt: 'money' },
  { header: 'Q4-26', field: 'q4_2026', fmt: 'money' },
  { header: 'FY-26 Total', field: 'fy_2026_total', fmt: 'money' },

  // ── After quarters (20) ──
  { header: 'Description', field: 'description', fmt: 'text' },
  { header: 'Tools', field: 'tools', fmt: 'text' },
  { header: 'KPI', field: 'kpi', fmt: 'text' },
  { header: 'Cost Drill Down', field: 'cost_drill_down', fmt: 'text' },
  { header: 'Start Date', field: 'start_date', fmt: 'date' },
  { header: 'End Date', field: 'end_date', fmt: 'date' },
  { header: 'CapEx/OpEx', field: 'capex_opex', fmt: 'text' },
  { header: 'ADV/Selling', field: 'adv_selling', fmt: 'text' },
  { header: 'SAP Event Code', field: 'sap_event_code', fmt: 'text' },
  { header: 'Event Type', field: 'event_type', fmt: 'text' },
  { header: 'Event Purpose', field: 'event_purpose', fmt: 'text' },
  { header: 'Cost Split Lenses %', field: 'cost_split_lenses', fmt: 'percent', backendOnly: true },
  { header: 'Cost Split Frames %', field: 'cost_split_frames', fmt: 'percent', backendOnly: true },
  { header: 'Forecasted Lenses Sales', field: 'forecast_lenses_sales', fmt: 'money', backendOnly: true },
  { header: 'Forecasted Frames Sales', field: 'forecast_frames_sales', fmt: 'money', backendOnly: true },
  { header: 'Forecasted Instruments Sales', field: 'forecast_instruments_sales', fmt: 'money', backendOnly: true },
  { header: 'PPT Required', field: 'ppt_slide_required', fmt: 'ppt' },
  { header: 'LOA Number', field: 'loa_number', fmt: 'text' },
  { header: 'Requestor Email', field: 'requestor_email', fmt: 'text' },
  { header: 'Finance Validator Email', field: 'finance_validator_email', fmt: 'text', backendOnly: true },
]

// Column widths (px) — long-text columns get more room, matching the export's
// wider Detail/Description/Tools/KPI columns.
const LONG_TEXT = new Set(['Detail', 'Description', 'Tools', 'KPI', 'Cost Drill Down', 'Event Purpose'])

export function columnWidth(header: string): number {
  if (LONG_TEXT.has(header)) return 240
  if (header.startsWith('Forecasted') || header.includes('Email')) return 180
  if (header === 'Type/Planning 2.0' || header === 'Legal Entity') return 150
  return 120
}
