// ============================================================
// LAURA — TypeScript types
// Aligned with backend reference_data.py (PDF v2 — June 2026)
// Source of truth: LAURA_Dropdown_Rules_CLIENT_v2.pdf
// ============================================================


// aligné sur backend WORKFLOW_TRANSITIONS (8 statuts) ────────
export type LOAStatus =
  | 'draft'
  | 'local_alignment'
  | 'emea_review'
  | 'global_review'
  | 'emea_post_global_review'
  | 'cmo_cfo_review'
  | 'emea_final_review'
  | 'corporate_review'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'on_hold'
  | 'archived'

/**
 * The STORED activity code. Never render one directly — pass it through
 * `activityLabel()` below.
 *
 * These used to be the Title Case labels. The 2026-08-25 audit found 2,609 rows
 * carrying these codes against 144 carrying the labels, so the vocabulary moved
 * to the data. Mirrors ACTIVITY_TYPE_LABELS in backend/reference_data.py.
 */
export type ActivityType =
  | 'TM_PERMANENT'
  | 'TM_SEASONAL'
  | 'COOP_ADVERTISING'
  | 'E_TOOLS'
  | 'IN_STORE'
  | 'SPONSORSHIP'
  | 'TRADE_INCENTIVE'
  | 'TRAINING'
  | 'PR'
  | 'CATALOGUES_BROCHURES'
  | 'MEDICAL_AFFAIRS'
  | 'EVENTS'
  | 'OTHER_ADVERTISING'
  | 'OTHER'

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
  is_locked: boolean          // set by super-admin via /lock and /unlock
  brand_review_deadline?: string
  cmo_comment?: string
  rejection_reason?: string

  // AI
  ai_suggestion_used: boolean

  // LOA cycles (nullable — set by the cycle/emergency workflow)
  cycle_id?: string | null
  is_emergency?: boolean
  ia_code?: string | null   // assigned on corporate approval (2026-XXXX)

  // Meta
  created_at: string
  updated_at: string
  submitted_at?: string
  approved_at?: string

  // Alignment sub-gate state (present when fetched at the relevant stage)
  finance_review_done?: boolean
  procurement_review_done?: boolean
  compliance_review_done?: boolean
  brand_review_done?: boolean
  function_review_done?: boolean
  cmo_approved?: boolean
  cfo_approved?: boolean
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
  | 'is_locked'
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
  'NORTH', 'META Excl Turkey', 'TURKEY', 'EAST', 'RUSSIA',
] as const

export const CLUSTER_COUNTRIES: Record<string, string[]> = {
  FRANCE:             ['France'],
  ITALY:              ['Italy'],
  DACH:               ['Germany', 'Austria', 'Switzerland'],
  IBERIA:             ['Spain', 'Portugal'],
  NORTH:              ['United Kingdom', 'Belgium', 'Netherlands', 'Finland', 'Sweden', 'Norway', 'Denmark', 'Nigeria'],
  'META Excl Turkey': ['South Africa', 'Israel', 'United Arab Emirates', "Cote D'Ivoire", 'Cameroon', 'Algeria', 'Estonia', 'Ethiopia', 'Gabon', 'Kenya', 'Kuwait', 'Morocco', 'Mauritius', 'Oman', 'Qatar', 'Serbia', 'Saudi Arabia', 'Senegal', 'Tunisia'],
  TURKEY:             ['Turkey'],
  EAST:               ['Greece', 'Poland', 'Croatia', 'Hungary', 'Czech Republic', 'Slovakia', 'Romania', 'Bulgaria'],
  RUSSIA:             ['Russia'],
}

export const LEGAL_ENTITIES_BY_COUNTRY: Record<string, string[]> = {
  'France':               ['LUXOTTICA FRANCE SASU', 'ESSILOR INTERNATIONAL SAS', 'BBGR', 'INVOPTIC', 'ESSILOR OUTRE-MER CARAÏBES', 'NOVACEL OPHTALMIQUE', 'MEGA OPTIC DESIGN', "Manufacture Lorraine d'Optique MONT-ROYAL"],
  'Italy':                ['LUXOTTICA ITALIA SRL', 'ESSILORLUXOTTICA WHOLESALE ITALIA SPA', 'L.T.L. Spa (LTL)'],
  'Germany':              ['LUXOTTICA GERMANY GMBH', 'ESSILOR GmbH', 'RUPP + HUBRACH OPTIK GMBH', 'Rupp & Hubrach - Branch IE', 'NIKA OPTICS GMBH', 'INFIELD Safety, GmbH', 'SIGNET ARMORLITE GERMANY HOLDING GmbH', 'SIGNET ARMORLITE OPTIC, GmbH'],
  'Austria':              ['LUXOTTICA AUSTRIA GMBH', 'ESSILOR AUSTRIA GmbH'],
  'Switzerland':          ['LUXOTTICA (SWITZERLAND) AG', 'ESSILOR SUISSE SA', 'REIZE OPTIK AG'],
  'Spain':                ['LUXOTTICA SPAIN SLU', 'ESSILOR ESPANA', 'ECP PLATFORM S.L.'],
  'Portugal':             ['LUXOTTICA PORTUGAL SA', 'ESSILOR PORTUGAL - Sociedade Industrial de óptica, Lda'],
  'United Kingdom':       ['LUXOTTICA NORTH EUROPE LTD', 'ESSILOR LIMITED', 'BBGR LIMITED', 'TRIFLE HOLDINGS LIMITED', 'LENSTEC', 'EMNUK Limited'],
  'Belgium':              ['LUXOTTICA BELGIUM NV', 'ESSILOR BELGIUM SA'],
  'Netherlands':          ['LUXOTTICA THE NETHERLANDS BV', 'ESSILOR NEDERLAND BV', 'INTERNATIONAL OPTICAL HOUSE HOLDING', 'ESSILOR NEDERLAND HOLDING BV'],
  'Finland':              ['OY LUXOTTICA FINLAND AB', 'ESSILOR OY'],
  'Sweden':               ['LUXOTTICA NORDIC AB', 'ESSILOR AB'],
  'Norway':               ['LUXOTTICA NORGE AS', 'ESSILOR NORGE A/S'],
  'Denmark':              ['ESSILOR DANMARK'],
  'Nigeria':              ['ESSILOR OPTICAL SUPPLY NIGERIA LTD'],
  'South Africa':         ['LUXOTTICA SOUTHERN AFRICA (PTY) LTD', 'ESSILOR SOUTH AFRICA (PROPRIETARY) LTD', 'RXPRESS OPTICAL PTY LTD', 'DAMAR OPTICAL (PTY) LTD'],
  'Israel':               ['LUXOTTICA OPTICS LTD', 'ESSILOR ISRAELI HOLDINGS LTD'],
  'United Arab Emirates': ['LUXOTTICA MIDDLE EAST FZE', 'ESSILOR OPTICAL SUPPLIES L.L.C.', 'ESSILOR MIDDLE EAST LIMITED (EMEL)', 'ESSILOR MIDDLE EAST INVESTMENT HOLDING FZCO', 'OPTICAL SUPPLIES MIDDLE EAST FZE (OSME)', 'E.E.D FZC (EED)', 'GHANADA OPTICAL LLC'],
  "Cote D'Ivoire":        ['SIVO WEST AFRICA'],
  'Cameroon':             ['SIVO CENTRAL AFRICA'],
  'Algeria':              ['ESSILOR SIVO ALGERIE', 'LTC Algeria'],
  'Estonia':              ['OPTIKA HULGIKAUBANDUSE OÜ'],
  'Ethiopia':             ['SUN OPTICAL TECHNOLOGIES PLC'],
  'Gabon':                ['ESSILOR DISTRIBUTION AFRIQUE CENTRALE - EDAC'],
  'Kenya':                ['ESSILOR EAST AFRICA LIMITED'],
  'Kuwait':               ['ESSILOR AMICO TRADING COMPANY WLL', 'NIKON OPTICAL MIDDLE EAST FOR MEDICAL AND SUNGLASSES WLL.'],
  'Morocco':              ['ESSILOR MOROCCO', 'MOVISIA S.A.'],
  'Mauritius':            ['OPHTHALMIC LENSES LTD'],
  'Oman':                 ['ESSILOR OPTICAL MUSCAT LLC'],
  'Qatar':                ['ESSILOR AMICO QATAR WLL'],
  'Serbia':               ['ESSILOR OPTICS d.o.o.'],
  'Saudi Arabia':         ['ESSILOR SAUDI ARABIA LTD'],
  'Senegal':              ['ESSILOR -SIVO SENEGAL'],
  'Tunisia':              ['ESSILOR SIVO SA', 'SIVO COMMERCIALE (SICOM DISTRIBUTION)', 'OPTICAL SUPPLY NORTH AFRICA (OSNA)'],
  'Turkey':               ['LUXOTTICA GOZLUK ENDUSTRI VE TICARET ANONIM SIRKETI', 'OPAK OPTIK SANAYI ve TICARET ANONIM SIRKETI', 'ISBIR OPTIK SANAYI ANONIM SIRKETI', 'ESEL OPTIK MAKINALARI ITHALAT IHRACAT PAZARLAMA VE TICARET ANONIM SIRKETI'],
  'Greece':               ['LUXOTTICA HELLAS AE'],
  'Poland':               ['LUXOTTICA POLAND SP ZOO', 'ESSILOR POLONIA Sp Z.o.o.', 'JZO Spolka Akcyjna', 'JAI KUDO LENSES S.R.O', 'JAI KUDO POLSKA S.P Z.O.O'],
  'Croatia':              ['LUXOTTICA SOUTH EASTERN EUROPE LTD', 'ESSILOR CROATIA'],
  'Hungary':              ['LUXOTTICA CENTRAL EUROPE KFT', 'ESSILOR OPTIKA KFT'],
  'Czech Republic':       ['ESSILOR OPTIKA spol. s.r.o.', 'OMEGA OPTIX S.R.O. - Tchéquie'],
  'Slovakia':             ['ESSILOR d.o.o.', 'ESSILOR SLOVAKIA sro'],
  'Romania':              ['ESSILOR ROMANIA S.R.L.', 'Rhein Romania'],
  'Bulgaria':             ['ESSILOR BULGARIA EOOD'],
  'Russia':               ['LUXOTTICA RUS LLC', 'ESSILOR LUIS OPTICA LLC', 'MARKETING OPTIC COMPANY (MOC)', 'MOC-BBGR', 'COMPANY GRANDVISION LLC', 'LOTUS FLOWER HOLDING BV', 'OPTIC CLUB LLC'],
}

/** Code -> what a person reads. Mirrors ACTIVITY_TYPE_LABELS on the backend. */
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  TM_PERMANENT:         'Permanent Visibility',
  TM_SEASONAL:          'Seasonal Visibility',
  COOP_ADVERTISING:     'Coop Advertising',
  E_TOOLS:              'e-Tools',
  IN_STORE:             'In Store / Consumer Activation',
  SPONSORSHIP:          'Sponsorship',
  TRADE_INCENTIVE:      'Trade Incentive',
  TRAINING:             'Training',
  PR:                   'PR',
  CATALOGUES_BROCHURES: 'Catalogues & Brochures',
  MEDICAL_AFFAIRS:      'Medical Affairs',
  EVENTS:               'Events',
  OTHER_ADVERTISING:    'Other ADV Expenses',
  OTHER:                'Others (non ADV)',
}

export const ACTIVITY_TYPES: ActivityType[] = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]

/**
 * Display form for a stored activity code.
 *
 * Unknown values pass through unchanged — 144 historical rows still hold the old
 * Title Case spelling, and showing that verbatim beats showing a blank.
 */
export function activityLabel(code: string | null | undefined): string {
  if (!code) return ''
  return ACTIVITY_TYPE_LABELS[code as ActivityType] ?? code
}

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

export const CATEGORY_OPTIONS = [
  'Frames',
  'Lenses',
  'Wearables',
  'Audio',
  'Instruments',
  'All cat.',
]

// Brand list with SAP codes — source: LAURA Dropdown Rules CLIENT v3 (August 2026).
// Display format: "Name (CODE)". Searchable by name or code.
// Bvlgari (BV/BG) and Diesel (DL/DI) appear with different codes — both kept.
export const BRANDS: { code: string; name: string }[] = [
  { code: '6A',     name: 'Costa del Mar Optical' },
  { code: 'FH',     name: 'Ferrari' },
  { code: 'A0',     name: 'Alain Mikli' },
  { code: 'AX',     name: 'Armani Exchange' },
  { code: 'AN',     name: 'Arnette' },
  { code: '6E',     name: 'Balenciaga' },
  { code: 'BE',     name: 'Burberry' },
  { code: 'BC',     name: 'Brunello Cucinelli' },
  { code: 'BV',     name: 'Bvlgari' },
  { code: '6L',     name: 'Cartier' },
  { code: 'CE',     name: 'Celine' },
  { code: 'CH',     name: 'Chanel' },
  { code: 'CD',     name: 'Christian Dior' },
  { code: 'HC',     name: 'Coach' },
  { code: 'DB',     name: 'DBYD' },
  { code: 'DY',     name: 'Dkny' },
  { code: 'DG',     name: 'Dolce & Gabbana' },
  { code: 'DK',     name: 'Donna Karan' },
  { code: 'EA',     name: 'Emporio Armani' },
  { code: 'EE',     name: 'Ess' },
  { code: 'FN',     name: 'Fendi' },
  { code: '99',     name: 'Generic All' },
  { code: 'Frames', name: 'Generic Line Luxottica' },
  { code: 'AR',     name: 'Giorgio Armani' },
  { code: 'GC',     name: 'Gucci' },
  { code: 'KX',     name: 'K & L Ophthalmic' },
  { code: 'LU',     name: 'Luxottica' },
  { code: 'MJ',     name: 'Maui Jim' },
  { code: 'MK',     name: 'Michael Kors' },
  { code: 'MU',     name: 'Miu Miu' },
  { code: 'OX',     name: 'Oakley Ophtalmic' },
  { code: 'OJ',     name: 'Oakley Sole Junior' },
  { code: 'OO',     name: 'Oakley Sunglasses' },
  { code: 'OY',     name: 'Oakley Vista Junior' },
  { code: 'OW',     name: 'Oakley Wearable' },
  { code: 'OV',     name: 'Oliver Peoples' },
  { code: 'PO',     name: 'Persol' },
  { code: 'PH',     name: 'Polo' },
  { code: 'PP',     name: 'Polo Prep' },
  { code: 'PR',     name: 'Prada' },
  { code: 'PS',     name: 'Prada Linea Rossa' },
  { code: 'RA',     name: 'Ralph' },
  { code: 'RL',     name: 'Ralph Lauren' },
  { code: 'RB',     name: 'Ray-Ban' },
  { code: 'RJ',     name: 'Ray-Ban Junior Sole' },
  { code: 'RY',     name: 'Ray-Ban Junior Vista' },
  { code: 'RX',     name: 'Ray-Ban Vista' },
  { code: 'SF',     name: 'Sferoflex' },
  { code: 'SH',     name: 'Starck Eyes' },
  { code: 'TF',     name: 'Tiffany' },
  { code: 'TD',     name: 'Tom Ford' },
  { code: 'TY',     name: 'Tory Burch' },
  { code: 'VA',     name: 'Valentino' },
  { code: 'VE',     name: 'Versace' },
  { code: 'VR',     name: 'Versus' },
  { code: 'VO',     name: 'Vogue' },
  { code: 'VJ',     name: 'Vogue Kids Sole' },
  { code: 'VY',     name: 'Vogue Kids Vista' },
  { code: 'YS',     name: 'Yves Saint Laurent' },
  { code: 'NE',     name: 'Seen' },
  { code: 'UJ',     name: 'Unofficial Junior' },
  { code: 'UO',     name: 'Unofficial' },
  { code: '6S',     name: 'Costa Del Mar' },
  { code: 'XD',     name: 'Native' },
  { code: 'RW',     name: 'Ray-Ban Wearable' },
  { code: 'EK',     name: 'Emporio Armani Kids' },
  { code: 'VK',     name: 'Versace Kids' },
  { code: 'DX',     name: 'Dolce & Gabbana Kids' },
  { code: 'MF',     name: 'Miraflex' },
  { code: 'P4',     name: 'Polaroid' },
  { code: 'DL',     name: 'Diesel' },
  { code: 'JB',     name: 'Burberry Kids' },
  { code: 'SK',     name: 'Swarovski' },
  { code: '0L',     name: 'Mont Blanc' },
  { code: 'ZB',     name: 'Bliz' },
  { code: 'ZK',     name: 'Bliz Goggle Kids' },
  { code: 'ZG',     name: 'Bliz Goggle' },
  { code: 'JC',     name: 'Jimmy Choo' },
  { code: 'FZ',     name: 'Ferrari Scuderia' },
  { code: 'ME',     name: 'Moncler' },
  { code: 'AW',     name: 'Nuance Audio' },
  { code: 'L6',     name: "Levi's" },
  { code: 'Q7',     name: 'EA7' },
  { code: 'Q8',     name: 'EA7 Goggle Snow' },
  { code: 'WX',     name: 'Moncler Goggles Snow' },
  { code: 'OM',     name: 'Oakley Goggles Mx' },
  { code: 'OZ',     name: 'Oakley Goggles Snow' },
  { code: 'BG',     name: 'Bvlgari' },
  { code: 'FO',     name: 'Foster Grant' },
  { code: 'F1E',    name: 'Molsion' },
  { code: 'BJ',     name: 'Bolon' },
  { code: 'FE',     name: 'Ferragamo' },
  { code: '02',     name: 'Generic - Other' },
  { code: '2S',     name: 'Silhouette' },
  { code: '4Y',     name: 'Alaia' },
  { code: 'BB',     name: 'Brooks Brothers' },
  { code: 'UT',     name: 'Unbranded Tier 1' },
  { code: 'OT',     name: 'Other Non Lux - Traditional' },
  { code: 'DJ',     name: 'DBYD Junior' },
  { code: 'NJ',     name: 'Seen Junior' },
  { code: '3E',     name: 'Disney' },
  { code: 'DI',     name: 'Diesel' },
  { code: 'LX',     name: 'Luxottica Lx' },
  { code: 'CK',     name: 'Calvin Klein' },
  { code: 'I1',     name: 'IC Berlin' },
  { code: 'P7',     name: 'Pierre Cardin' },
  { code: '2C',     name: 'Prescriptions Brands - Turkey' },
  { code: 'RO',     name: 'Ray-Ban Rox' },
  { code: 'PL',     name: 'Rl Purple Label' },
  { code: 'AV',     name: 'Adrienne Vittadini' },
  { code: 'AK',     name: 'Anne Klein' },
  { code: 'BY',     name: 'Byblos' },
  { code: '5S',     name: 'Carrera' },
  { code: 'CT',     name: 'Charmant' },
  { code: '6N',     name: 'Chloe' },
  { code: 'C8',     name: 'Chopard' },
  { code: 'D4',     name: 'Dita' },
  { code: 'GY',     name: 'Genny' },
  { code: 'JS',     name: 'Jil Sander' },
  { code: 'MO',     name: 'Moschino' },
  { code: 'MT',     name: 'Mosley Tribes' },
  { code: 'YY',     name: 'Other Marketing' },
  { code: 'SM',     name: 'Stella Mccartney' },
  { code: 'NL',     name: 'Polinelli' },
  { code: '8G',     name: 'Generic 3P Code' },
  { code: 'LC',     name: 'Luxottica Collection' },
  { code: 'FU',     name: 'Furla' },
  { code: 'EU',     name: 'Stellest Frames' },
  { code: 'EW',     name: 'Stellest Wearable' },
  { code: '0A',     name: 'Aes' },
]

// Flat display strings: "Name (CODE)" — used by SearchableSelect
export const BRAND_OPTIONS: string[] = BRANDS.map(b => `${b.name} (${b.code})`)

// Legacy alias — kept for any remaining consumers
export const BRANDS_BY_CATEGORY: Record<string, string[]> = { All: BRAND_OPTIONS }
export function getBrandsForCategories(_cats: string[]): string[] { return BRAND_OPTIONS }

// Status badge config — single source of truth for all pages.
// Badge CSS classes are defined in globals.css.
// ── APRÈS — 8 statuts, classes badge alignées sur globals.css ──────────
export const STATUS_CONFIG: Record<LOAStatus, { label: string; cls: string }> = {
  draft:                    { label: 'Draft',              cls: 'badge-draft' },
  local_alignment:          { label: 'Alignment Review',  cls: 'badge-emea-review' },
  emea_review:              { label: 'EMEA Review',        cls: 'badge-emea-review' },
  global_review:            { label: 'Global Review',      cls: 'badge-global-review' },
  emea_post_global_review:  { label: 'EMEA Post-Review',   cls: 'badge-emea-review' },
  cmo_cfo_review:           { label: 'CMO / CFO Review',   cls: 'badge-cmo-cfo-review' },
  emea_final_review:        { label: 'EMEA Final Review',  cls: 'badge-emea-review' },
  corporate_review:         { label: 'Corporate Review',   cls: 'badge-corporate-review' },
  approved:                 { label: 'Approved',           cls: 'badge-approved' },
  rejected:                 { label: 'Rejected',           cls: 'badge-rejected' },
  returned:                 { label: 'Returned',           cls: 'badge-rejected' },
  on_hold:                  { label: 'On Hold',            cls: 'badge-cmo-cfo-review' },
  archived:                 { label: 'Archived',           cls: 'badge-draft' },
}

export const EVENT_ACTIVITY_TYPES: ActivityType[] = ['EVENTS', 'MEDICAL_AFFAIRS']

export const DOOR_ACTIVITY_TYPES: ActivityType[] = [
  'TM_PERMANENT', 'TM_SEASONAL',
  'COOP_ADVERTISING', 'IN_STORE',
  'TRADE_INCENTIVE', 'CATALOGUES_BROCHURES',
]

export const NO_DOOR_ACTIVITY_TYPES: ActivityType[] = ['SPONSORSHIP']
