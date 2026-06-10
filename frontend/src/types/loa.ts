// ============================================================
// LAURA — TypeScript types
// Aligned with backend reference_data.py (PDF v2 — June 2026)
// Source of truth: LAURA_Dropdown_Rules_CLIENT_v2.pdf
// ============================================================

export type LOAStatus =
  | 'draft'
  | 'submitted'
  | 'brand_review'
  | 'cmo_review'
  | 'cfo_review'
  | 'approved'
  | 'rejected'

export type ActivityType =
  | 'Permanent Visibility'
  | 'Seasonal Visibility'
  | 'Coop Advertising'
  | 'e-Tools'
  | 'In Store / Consumer Activation'
  | 'Sponsorship'
  | 'Trade Incentive'
  | 'Training'
  | 'PR'
  | 'Catalogues & Brochures'
  | 'Medical Affairs'
  | 'Events'
  | 'Other ADV Expenses'
  | 'Others (non ADV)'

export interface LOA {
  id: string
  loa_draft_id: string
  loa_number?: string
  requestor_email: string

  // Location
  cluster: string
  country: string
  legal_entity?: string

  // Activity
  activity_type: ActivityType
  event_type?: string
  event_purpose?: string
  sap_event_code?: string
  cot: string

  // Category is now MULTI-SELECT
  category: string[]
  brand: string

  // Financial classification
  capex_opex: 'OpEx' | 'CapEx'
  adv_selling: 'ADV' | 'Selling' | 'Others'

  // Investment
  detail?: string
  customer?: string
  vendor?: string
  currency: string
  num_customers?: number
  num_doors?: number

  // Financials — user inputs
  q4_2025: number
  q1_2026: number
  q2_2026: number
  q3_2026: number
  q4_2026: number

  // Financials — calculated (read-only)
  fy_2025_total: number
  fy_2026_total: number
  avg_investment_per_door?: number
  ppt_slide_required: boolean

  // PPT content
  description?: string
  tools?: string
  kpi?: string
  cost_drill_down?: string
  timing?: string

  // Dates
  start_date?: string
  end_date?: string

  // Status
  status: LOAStatus
  brand_review_deadline?: string
  cmo_comment?: string
  rejection_reason?: string

  // AI
  ai_suggestion_used: boolean

  // Meta
  created_at: string
  updated_at: string
  submitted_at?: string
  approved_at?: string
}

export type LOAFormValues = Omit <
  LOA,
  | 'id'
  | 'loa_draft_id'
  | 'loa_number'
  | 'fy_2025_total'
  | 'fy_2026_total'
  | 'avg_investment_per_door'
  | 'ppt_slide_required'
  | 'status'
  | 'brand_review_deadline'
  | 'cmo_comment'
  | 'rejection_reason'
  | 'ai_suggestion_used'
  | 'created_at'
  | 'updated_at'
  | 'submitted_at'
  | 'approved_at'
>

export interface AISuggestion {
  description: string
  kpi: string
  tools: string
  log_id?: string
}

// ────────────────────────────────────────────────────────────
// Dropdown reference data — aligned with backend/reference_data.py
// (Same source: PDF v2, but kept in sync manually for now.
//  Lot 1 phase 2 will replace this with a runtime fetch.)
// ────────────────────────────────────────────────────────────

export const CLUSTERS = [
  'FRANCE', 'ITALY', 'DACH', 'IBERIA',
  'NORTH', 'META', 'EAST', 'EMEA', 'RUSSIA',
] as const

// Cluster → Country cascade
export const CLUSTER_COUNTRIES: Record<string, string[]> = {
  FRANCE: ['France'],
  ITALY:  ['Italy'],
  DACH:   ['Germany', 'Austria', 'Switzerland'],
  IBERIA: ['Spain', 'Portugal'],
  NORTH:  ['UK', 'Belgium', 'Netherlands', 'Nordics'],
  META:   ['Israel', 'GCC & Export', 'Turkey', 'North Africa', 'South Africa'],
  EAST:   ['Romania', 'Czech Republic + Slovakia', 'Hungary', 'Poland & Baltics', 'Greece', 'SEE'],
  EMEA:   ['EMEA'],
  RUSSIA: ['Russia'],
}

// Country → Legal Entities (combobox: pick or type freely)
export const LEGAL_ENTITIES_BY_COUNTRY: Record<string, string[]> = {
  'France': ['EL France', 'Essilor France', 'Luxottica France', 'BBGR', 'Nikon France', 'NOVACEL', "France PS (all BU's)"],
  'Italy': ['ELWI', 'Essilor Italie'],
  'Germany': ['EL Germany', 'Essilor Germany', 'Luxottica Germany', 'Nika', 'R+H'],
  'Austria': ['EL Austria', 'Essilor Austria', 'Luxottica Austria'],
  'Switzerland': ['Essilor Switzerland', 'Luxottica Switzerland', 'Reize'],
  'Spain': ['Essilor Spain', 'EssilorLuxottica Spain', 'Luxottica Spain'],
  'Portugal': ['Essilor Portugal', 'EssilorLuxottica Portugal', 'Luxottica Portugal'],
  'UK': ['Essilor Ltd', 'LNE', 'Luxottica LNE', 'Transitions'],
  'Belgium': ['EssilorLuxottica Belgium', 'LNE'],
  'Netherlands': ['EssilorLuxottica Netherlands', 'LNE', 'Luxottica'],
  'Nordics': ['Essilor', 'LNE', 'Luxottica LNE'],
  'Israel': ['Luxottica Israel'],
  'GCC & Export': ['Essilor KSA', 'Essilor Optical Supplies UAE', 'Essilor Saudi Arabia', 'Luxottica Middle East'],
  'Turkey': ['Essilor Luxottica Turkey'],
  'North Africa': ['Luxottica Middle East'],
  'South Africa': ['Luxottica Southern Africa'],
  'Romania': ['EssilorRomania', 'Rhein Vision'],
  'Czech Republic + Slovakia': ['ESSILOR', 'Luxottica Central Europe Kft', 'OMEGA OPTIX'],
  'Hungary': ['Essilor Optika Kft.', 'Luxottica Central Europe Kft'],
  'Poland & Baltics': ['ESSILOR', 'Essilor Polonia', 'JAI KUDO Poland', 'JZO Poland', 'Luxottica Baltics', 'Luxottica Poland'],
  'Greece': ['Bairamoglou', 'LUXOTTICA HELLAS'],
  'SEE': ['Essilor Adria', 'Essilor Bulgaria', 'Essilor Croatia', 'Essilor Serbia', 'Essilor Slovenia', 'Luxottica SEE'],
  'EMEA': ['Essilor International', 'Transitions'],
  'Russia': ['Essilor Luis Optica'],
}

export const ACTIVITY_TYPES: ActivityType[] = [
  'Permanent Visibility',
  'Seasonal Visibility',
  'Coop Advertising',
  'e-Tools',
  'In Store / Consumer Activation',
  'Sponsorship',
  'Trade Incentive',
  'Training',
  'PR',
  'Catalogues & Brochures',
  'Medical Affairs',
  'Events',
  'Other ADV Expenses',
  'Others (non ADV)',
]

export const EVENT_TYPES = [
  'Roadshow',
  'Showroom',
  'Sales Convention',
  'Trade Fairs',
  'Medical Symposium',
  'Client Award Travel',
  'Tortona EL Days',
]

export const EVENT_PURPOSES = [
  'Transactional',
  'Inspirational',
  'Influential',
  'Relational',
]

export const COT_OPTIONS = [
  'All COT',
  'Chains',
  'Buying Groups',
  'Independents',
  'E-Wholesale',
  'Sport channel',
  'Travel Retail',
  'Distr. & Export',
  'Others',
]

// Categories are MULTI-SELECT (e.g. Frames + Lenses)
export const CATEGORY_OPTIONS = [
  'Frames',
  'Lenses',
  'Wearables',
  'Audio',
  'Instruments',
  'All cat.',
]

// Brand list by category
export const BRANDS_BY_CATEGORY: Record<string, string[]> = {
  'Frames': [
    // House Brands
    'HB - Ray-Ban', 'HB - Ray-Ban Meta', 'HB - Oakley', 'HB - Vogue',
    'HB - Persol', 'HB - Oliver Peoples', 'HB - Alain Mikli', 'HB - BLIZ',
    'HB - Arnette', 'HB - Others', 'all HB', 'Sport (OO/ZB/OW)',
    // License Brands
    'LB - Luxury', 'LB - PFF', 'LB - Armani Exchange', 'LB - Brunello Cucinelli',
    'LB - Burberry', 'LB - Chanel', 'LB - Dolce & Gabbana', 'LB - Emporio Armani',
    'LB - Ferrari', 'LB - Ferrari Scuderia', 'LB - Giorgio Armani', 'LB - Jimmy Choo',
    'LB - Michael Kors', 'LB - Miu Miu', 'LB - Moncler', 'LB - Prada',
    'LB - Prada Linea Rossa', 'LB - Polo Ralph Lauren', 'LB - Polo', 'LB - Ralph',
    'LB - Swarovski', 'LB - Starck Eye', 'LB - Tiffany', 'LB - Versace',
    'LB - Others', 'all LB',
    'all HB + all LB',
  ],
  'Lenses': [
    'Essilor - Varilux', 'Essilor - Stellest', 'Essilor - Eyezen',
    'Essilor - Crizal', 'Essilor - Masterbrand', 'Essilor - Multibrand',
    'Multibrand', 'Nikon', 'Kodak', 'Transitions', 'Galileo', 'Reize',
    'R + H', 'Others',
  ],
  'Audio': ['Nuance'],
  'Instruments': ['Essilor - Multibrand', 'Essilor - Masterbrand', 'Others'],
  'Wearables': [
    'HB - Oakley', 'HB - Oakley Meta',
    'HB - Ray-Ban', 'HB - Ray-Ban Meta',
  ],
  'All cat.': [
    'all HB + all LB', 'Essilor - Multibrand', 'all HB', 'Others',
  ],
}

// Helper: get brands for multiple selected categories
export function getBrandsForCategories(cats: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const cat of cats) {
    const brands = BRANDS_BY_CATEGORY[cat] || []
    for (const b of brands) {
      if (!seen.has(b)) {
        seen.add(b)
        result.push(b)
      }
    }
  }
  return result
}

// Legacy flat list — kept for backwards compatibility
export const BRAND_OPTIONS = Array.from(
  new Set(Object.values(BRANDS_BY_CATEGORY).flat())
)

export const STATUS_CONFIG: Record<LOAStatus, { label: string; color: string }> = {
  draft:        { label: 'Draft',         color: 'bg-slate-700 text-slate-300' },
  submitted:    { label: 'Submitted',     color: 'bg-blue-900 text-blue-300' },
  brand_review: { label: 'Brand review',  color: 'bg-purple-900 text-purple-300' },
  cmo_review:   { label: 'CMO review',    color: 'bg-amber-900 text-amber-300' },
  cfo_review:   { label: 'CFO review',    color: 'bg-orange-900 text-orange-300' },
  approved:     { label: 'Approved',      color: 'bg-green-900 text-green-300' },
  rejected:     { label: 'Rejected',      color: 'bg-red-900 text-red-300' },
}

export const EVENT_ACTIVITY_TYPES: ActivityType[] = ['Events', 'Medical Affairs']

export const DOOR_ACTIVITY_TYPES: ActivityType[] = [
  'Permanent Visibility', 'Seasonal Visibility',
  'Coop Advertising', 'In Store / Consumer Activation',
  'Trade Incentive', 'Catalogues & Brochures',
]

export const NO_DOOR_ACTIVITY_TYPES: ActivityType[] = ['Sponsorship']