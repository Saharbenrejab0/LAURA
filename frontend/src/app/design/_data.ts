/**
 * LAURA — Design-doc seed data
 * -----------------------------------------------------------------------------
 * Faithful TypeScript port of the `DCLogic` component data from the Claude
 * design doc "LAURA CMO Review Mockups". Every array here maps 1:1 to the
 * `sc-for` lists in the original markup, with the same helper-derived style
 * props pre-computed. Screens under ./screens consume these directly.
 *
 * Money / glyphs are kept exactly as the design (European decimals, € symbol).
 */

/* ── Palette ─────────────────────────────────────────────────────────── */
export const C = {
  ink: '#1A1815',
  inkText: '#F6F4EF',
  canvas: '#F6F4EF',
  subtle: '#FDFBF7',
  cream: '#F0EDE6',
  surface: '#FFFFFF',
  border: '#E4DFD5',
  borderSoft: '#F5F2EB',
  borderStrong: '#CFC8B8',
  line: '#DAD6CE',
  gold: '#B08D2F',
  goldSoft: '#EFE3C2',
  goldWarm: '#C9A678',
  navy: '#1B365D',
  navy2: '#1F3A5F',
  navyMid: '#5B87B8',
  navyLight: '#8FB0D4',
  t1: '#1A1815',
  t2: '#6B6558',
  t3: '#9A9284',
  t4: '#9A948C',
  danger: '#A7443E',
  dangerDeep: '#650B0B',
  dangerBd: '#DEB0AC',
  dangerBg: '#F8ECEA',
  dangerBg2: '#F7DEDE',
  dangerSoft: '#FDF6F5',
  success: '#0B653F',
  successBg: '#DEF7ED',
  warn: '#5C4508',
  warnMid: '#8A6D1F',
  warnBg: '#F3E8CC',
  // dark stage
  stage: '#16150F',
  dark: '#1A1815',
  darkest: '#0E0D0B',
  darkPanel: '#1E1C16',
  darkPanel2: '#26241C',
  darkLine: '#2A2822',
  darkLine2: '#3A362D',
  darkMuted: '#A9A290',
  darkMuted2: '#726C5D',
  darkText: '#F4EEDF',
  gold2: '#D9B968',
  greenGlow: '#B3E6D0',
  redGlow: '#E6B3B3',
}

export const FONT = {
  sans: "'DM Sans', system-ui, sans-serif",
  display: "'Cormorant Garamond', Georgia, serif",
  mono: "'JetBrains Mono', 'DM Mono', ui-monospace, monospace",
}

/* ── 1a · slide brand table rows ─────────────────────────────────────── */
export const rows = [
  { brand: 'HB - Ray-Ban', doors: '240', avg: '500 €', q3: '120.000', bg: '#FDF3F3' },
  { brand: 'LB - Prada', doors: '120', avg: '450 €', q3: '54.000', bg: '#FFFFFF' },
  { brand: 'LB - Versace', doors: '90', avg: '450 €', q3: '40.500', bg: '#FFFFFF' },
  { brand: 'LB - Emporio Armani', doors: '130', avg: '500 €', q3: '40.000', bg: '#FFFFFF' },
  { brand: 'LB - Miu Miu', doors: '90', avg: '444 €', q3: '40.000', bg: '#FFFFFF' },
]

/* ── 1a · comments pinned to slide zones ─────────────────────────────── */
export const slideComments: Record<string, {
  author: string; meta: string; initials: string; avatar: string; body: string; top: string; left: string
}> = {
  '1': {
    author: 'Alexandra', meta: 'Regional CMO · entered by Thibault · now', initials: 'A', avatar: C.dangerDeep,
    body: 'Ray-Ban at 120K€ inside a Super Trade Light slide is too heavy — phase it: Q3 pilot on 120 doors, rest to Q4.',
    top: '318px', left: '300px',
  },
  '2': {
    author: 'Marc', meta: 'Regional CFO · 2 min ago', initials: 'M', avatar: C.warn,
    body: 'Confirm the Vetrina In rate card is the 2026 one before we lock 554,5K€.',
    top: '178px', left: '196px',
  },
  'new': {
    author: 'Alexandra', meta: 'Regional CMO · new pin', initials: 'A', avatar: C.gold,
    body: 'Draft: 453 €/door is high for windows covering — compare against the Q3-25 actuals before approval.',
    top: '318px', left: '300px',
  },
}

/* ── 1b · deck-order rail (Frames tree, left of the card stack) ───────── */
export const queueDeck = [
  { label: 'Frames', count: '18', pad: '7px 9px', bg: '#1E1C16', dot: C.greenGlow, indent: false, fg: C.darkText, weight: 600 },
  { label: 'TM Seasonal', count: '3/5', pad: '6px 9px 6px 24px', bg: '#2A2822', dot: '', indent: true, fg: C.darkText, weight: 600, meta: C.gold2 },
  { label: 'TM Permanent', count: '0/2', pad: '6px 9px 6px 24px', bg: 'transparent', dot: '', indent: true, fg: C.darkMuted, weight: 500 },
  { label: 'Coop ADV', count: '0/4', pad: '6px 9px 6px 24px', bg: 'transparent', dot: '', indent: true, fg: C.darkMuted, weight: 500 },
  { label: 'In-store activation', count: '0/3', pad: '6px 9px 6px 24px', bg: 'transparent', dot: '', indent: true, fg: C.darkMuted, weight: 500 },
  { label: 'Sponsorship', count: '0/2', pad: '6px 9px 6px 24px', bg: 'transparent', dot: '', indent: true, fg: C.darkMuted, weight: 500 },
]

/* ── 1c / 1e · flagged-first table ───────────────────────────────────── */
export const flagged = [
  { no: '05', title: 'Seasonal Visibility: HB & LB', activity: 'TM Seasonal', amount: '554,5K', perDoor: '453 €', doorColor: C.dangerDeep, tag: '2.1× median', tagBg: C.dangerBg2, tagFg: C.dangerDeep },
  { no: '08', title: 'Seasonal Vis.: High Visibility LBs', activity: 'TM Seasonal', amount: '218,3K', perDoor: '8 396 €', doorColor: C.dangerDeep, tag: 'Cost/door', tagBg: C.dangerBg2, tagFg: C.dangerDeep },
  { no: '11', title: 'Permanent Visibility: HB + LB', activity: 'TM Permanent', amount: '270,0K', perDoor: '1 350 €', doorColor: C.warn, tag: 'New scope', tagBg: C.warnBg, tagFg: C.warn },
  { no: '17', title: 'Oakley: Alta Badia Sponsorship', activity: 'Sponsorship', amount: '128,0K', perDoor: '—', doorColor: C.t3, tag: 'No KPI', tagBg: C.warnBg, tagFg: C.warn },
  { no: '20', title: 'Nuance — Rialto launch 360°', activity: 'Other ADV', amount: '240,0K', perDoor: '—', doorColor: C.t3, tag: '+38% YoY', tagBg: C.dangerBg2, tagFg: C.dangerDeep },
  { no: '25', title: 'Attack Plan Wave 2: Varilux', activity: 'Lens activation', amount: '370,0K', perDoor: '—', doorColor: C.t3, tag: 'Overlap w/ 27', tagBg: C.warnBg, tagFg: C.warn },
]

/* ── 1e · session minutes ────────────────────────────────────────────── */
export const minutes = [
  { no: '05', title: 'Seasonal Visibility: HB & LB', activity: 'TM Seasonal', amount: '554,5K', state: 'Sent back', bg: C.dangerBg2, fg: C.dangerDeep },
  { no: '06', title: 'Seasonal Visibility: All HBs', activity: 'TM Seasonal', amount: '69,0K', state: 'Approved', bg: C.successBg, fg: C.success },
  { no: '07', title: 'Seasonal Visibility: All LBs', activity: 'TM Seasonal', amount: '192,0K', state: 'Approved', bg: C.successBg, fg: C.success },
  { no: '08', title: 'High Visibility LBs', activity: 'TM Seasonal', amount: '218,3K', state: 'Deferred', bg: C.warnBg, fg: C.warn },
  { no: '09', title: 'Digital Windows Monobrand', activity: 'TM Seasonal', amount: '247,6K', state: 'Approved', bg: C.successBg, fg: C.success },
  { no: '11', title: 'Permanent Visibility: HB + LB', activity: 'TM Permanent', amount: '270,0K', state: 'Approved', bg: C.successBg, fg: C.success },
  { no: '17', title: 'Oakley: Alta Badia Sponsorship', activity: 'Sponsorship', amount: '128,0K', state: 'Approved', bg: C.successBg, fg: C.success },
]

/* ── 1d · present-mode permanent slide rows ──────────────────────────── */
export const permRows = [
  { brand: 'HB - Ray-Ban', detail: 'Corner refresh', doors: '90', avg: '1 300 €', q3: '117.000' },
  { brand: 'HB - Oakley', detail: 'Back wall', doors: '40', avg: '1 250 €', q3: '50.000' },
  { brand: 'LB - Prada', detail: 'Corner refresh', doors: '30', avg: '1 600 €', q3: '48.000' },
  { brand: 'LB - Miu Miu', detail: 'Corner refresh', doors: '20', avg: '1 400 €', q3: '28.000' },
  { brand: 'HB - Persol', detail: 'Back wall', doors: '20', avg: '1 350 €', q3: '27.000' },
]

/* ── 3a · pipeline (where the 376 LOAs are stuck) ────────────────────── */
type PState = 'ok' | 'block' | 'live'
const P = (stage: string, owner: string, n: string, amt: string, pct: string, note: string, state: PState, flex: number) => ({
  stage, owner, n, amt, pct, note, flex,
  bg: state === 'block' ? C.dangerSoft : state === 'live' ? C.subtle : C.surface,
  bd: state === 'block' ? C.dangerBd : state === 'live' ? C.goldSoft : C.border,
  labelFg: state === 'block' ? C.danger : C.t2,
  ownerFg: C.t3,
  nFg: state === 'block' ? C.danger : C.ink,
  barFg: state === 'block' ? C.danger : state === 'live' ? C.gold : C.borderStrong,
  noteFg: state === 'block' ? C.danger : C.t3,
})
export const pipeline = [
  P('1 · Local', 'markets', '18', '2,1 M', '12%', 'finance + compliance', 'ok', 1),
  P('2 · Regional', 'T·V·S', '41', '4,9 M', '28%', '9 waiting > 48h', 'block', 1.15),
  P('3 · Global B&F', 'parallel', '26', '3,2 M', '18%', 'brands + functions', 'ok', 1),
  P('4 · CMO / CFO', 'session', '44', '5,6 M', '32%', 'session in 4 days', 'live', 1.2),
  P('5 · Corporate', 'mktg + fin', '12', '1,4 M', '8%', 'full pptx + xlsx', 'ok', 1),
  P('7 · Final + IA', 'approval', '5', '0,6 M', '4%', '5 codes to mint', 'block', 1),
  P('Approved', 'locked', '230', '16,3 M', '100%', 'sent back to local', 'ok', 1),
]

/* ── 3a · needs-you-today tasks ──────────────────────────────────────── */
export const adminTasks = [
  { icon: '⏳', iconBg: C.warnBg, iconFg: C.warn, title: '9 LOAs stuck at Regional for over 48h', sub: 'DACH and NORTH · Vanessa has 6 of them', cta: 'Nudge' },
  { icon: '⚑', iconBg: C.dangerBg, iconFg: C.danger, title: '5 approvals waiting for an IA code', sub: 'Cannot be sent back to local until minted', cta: 'Mint codes' },
  { icon: '◔', iconBg: C.cream, iconFg: C.t2, title: '2 users without a role', sub: 'm.rossi@, l.dubois@ — joined this week', cta: 'Assign' },
  { icon: '↩', iconBg: C.dangerBg, iconFg: C.danger, title: '3 rejections not yet reworked', sub: 'Returned 6 days ago · deadline in 4', cta: 'Open' },
  { icon: '◷', iconBg: C.cream, iconFg: C.t2, title: 'Emergency EM-02 closes tomorrow', sub: '1 of 2 authorised marketers has not submitted', cta: 'Remind' },
]

/* ── 3a · notifications ──────────────────────────────────────────────── */
type NState = 'done' | 'next' | 'todo'
const N = (label: string, channel: string, when: string, state: NState) => ({
  label, channel, when,
  dot: state === 'done' ? '✓' : '',
  dotBg: state === 'done' ? C.successBg : state === 'next' ? C.gold : C.cream,
  dotFg: state === 'done' ? C.success : '#FFFFFF',
  whenFg: state === 'next' ? C.gold : C.t3,
})
export const notifs = [
  N('Kick-off — cycle dates + session date', 'Email · all', 'sent 1 Jul', 'done'),
  N('Reminder to local marketers', 'Teams · cluster channels', 'sent 8 Jul', 'done'),
  N('3 days before end date, by cluster', 'Teams · cluster channels', 'tomorrow', 'next'),
  N('2 and 1 day before end date', 'Teams · cluster channels', '13–14 Jul', 'todo'),
  N('All submitted — session ready', 'Teams · EMEA', 'on close', 'todo'),
]

/* ── 3a · generate & distribute outputs ──────────────────────────────── */
export const outputs = [
  { tag: 'PPTX', tagBg: C.navy2, tagFg: '#FFFFFF', title: 'Full deck for the session', sub: '376 slides · dividers + overviews generated', cta: 'Generate' },
  { tag: 'PPTX', tagBg: C.navyMid, tagFg: '#FFFFFF', title: 'CMO deck with summary slides', sub: 'Approved only · from CMO onwards', cta: 'Generate' },
  { tag: 'XLSX', tagBg: C.success, tagFg: '#FFFFFF', title: 'Quarterly summary', sub: 'CFO + Corporate + EMEA admins · Q1–Q4 + cluster breakdown', cta: 'Generate' },
  { tag: 'XLSX', tagBg: C.t2, tagFg: '#FFFFFF', title: 'Full export — 39 columns', sub: 'Detailed LOA rows, same shape as the template', cta: 'Export' },
]

/* ── 3a · permission matrix ──────────────────────────────────────────── */
const CELL: Record<string, { bg: string; fg: string; label: string }> = {
  A: { bg: '#EFE3C2', fg: '#8A6D1F', label: 'A' },
  V: { bg: '#E7E0F2', fg: '#3A2A5E', label: 'V' },
  E: { bg: '#DCE8F7', fg: '#123C6B', label: 'E' },
  C: { bg: '#F3E8CC', fg: '#5C4508', label: 'C' },
  R: { bg: '#F6F4EF', fg: '#6B6558', label: 'R' },
  '-': { bg: 'transparent', fg: '#CFC8B8', label: '—' },
}
const cell = (k: string) => CELL[k]
export const matrix = [
  { role: 'Local marketer', cells: ['E', 'R', '-', '-', '-'].map(cell) },
  { role: 'Local finance / compliance', cells: ['C', 'R', '-', '-', '-'].map(cell) },
  { role: 'Regional team', cells: ['E', 'A', 'V', 'R', 'R'].map(cell) },
  { role: 'Global brand / function', cells: ['R', 'C', 'V', '-', '-'].map(cell) },
  { role: 'CMO / CFO', cells: ['R', 'R', 'R', 'A', 'R'].map(cell) },
  { role: 'EMEA admin', cells: ['E', 'A', 'A', 'A', 'A'].map(cell) },
]

/* ── 3a · emergency lane ─────────────────────────────────────────────── */
export const emergencies = [
  { name: 'EM-01 · Ray-Ban PR France', window: '2–12 Jul', who: 'S. Leroy', left: '2d left', leftFg: C.danger },
  { name: 'EM-02 · Oakley Riva Alta DACH', window: '5–13 Jul', who: 'M. Weber, K. Ott', left: '1d left', leftFg: C.danger },
  { name: 'EM-03 · Persol pop-up Milan', window: '9–23 Jul', who: 'G. Conti', left: '11d left', leftFg: C.t2 },
]

/* ── 3b · authorised-marketer chips ──────────────────────────────────── */
const mk = (name: string, on: boolean) => ({
  name, check: on ? '✓ ' : '',
  bg: on ? C.danger : '#FFFFFF', fg: on ? '#FFFFFF' : C.t2, bd: on ? C.danger : C.border,
})
export const marketerChips = [
  mk('S. Leroy · FRANCE', true), mk('M. Weber · DACH', true), mk('G. Conti · ITALY', true),
  mk('K. Ott · DACH', false), mk('P. Novak · EAST', false), mk('A. Ruiz · IBERIA', false),
  mk('J. Smit · NORTH', false), mk('D. Yilmaz · META', false),
]

/* ── 3c · submit-summary rows ────────────────────────────────────────── */
export const submitSummary = [
  { label: 'LOAs reviewed', n: '14', icon: '✓', iconBg: C.successBg, iconFg: C.success, nFg: C.ink, bg: '#FFFFFF' },
  { label: 'Comments to publish', n: '6', icon: '✎', iconBg: C.warnBg, iconFg: C.warn, nFg: C.ink, bg: '#FFFFFF' },
  { label: 'Changes requested', n: '2', icon: '↺', iconBg: C.dangerBg, iconFg: C.danger, nFg: C.danger, bg: '#FFFFFF' },
  { label: 'Not opened — will pass with no input', n: '4', icon: '!', iconBg: C.dangerBg, iconFg: C.danger, nFg: C.danger, bg: C.dangerSoft },
]

/* ── 2a · tracker filter chips ───────────────────────────────────────── */
export const trackerFilters = [
  { label: 'Status: CMO / CFO Review', bd: C.gold, fg: C.ink, bg: C.goldSoft },
  { label: 'Cluster', bd: C.border, fg: C.t2, bg: '#FFFFFF' },
  { label: 'Quarter', bd: C.border, fg: C.t2, bg: '#FFFFFF' },
  { label: 'Owner', bd: C.border, fg: C.t2, bg: '#FFFFFF' },
  { label: 'Flagged by Laura', bd: C.border, fg: C.t2, bg: '#FFFFFF' },
]

/* ── 2a · deck hierarchy tree ────────────────────────────────────────── */
const FLAGMAP: Record<string, [string, string]> = {
  '': ['transparent', 'transparent'], 'clean': [C.successBg, C.success],
  '1 outlier': [C.dangerBg2, C.dangerDeep], '2 flagged': [C.warnBg, C.warn],
  'split': [C.warnBg, C.warn], '1 flagged': [C.warnBg, C.warn],
}
const DECMAP: Record<string, string> = {
  'Approved': C.success, 'Rejected': C.dangerDeep, 'CMO / CFO Review': C.warnMid,
  'EMEA Final Review': C.warnMid, '': C.t3,
}
const T = (lvl: number, name: string, kind: string, cluster: string, lines: string, amount: string, flag: string, dec: string) => ({
  name, kind, cluster, lines, amount, flag, dec,
  indent: (lvl * 15) + 'px',
  pad: lvl === 0 ? '10px 16px' : '8px 16px',
  bg: lvl === 0 ? C.cream : lvl === 1 ? C.subtle : '#FFFFFF',
  font: lvl === 0 ? `700 12.5px ${FONT.sans}` : lvl === 1 ? `600 12px ${FONT.sans}` : `400 12px ${FONT.sans}`,
  fg: C.ink,
  chev: lvl === 2 ? '' : '▾',
  flagBg: (FLAGMAP[flag] || FLAGMAP[''])[0], flagFg: (FLAGMAP[flag] || FLAGMAP[''])[1],
  decFg: DECMAP[dec] || C.t3,
})
export const tree = [
  T(0, 'FRAMES', 'category', '8 clusters', '742', '18,4 M€', '2 flagged', ''),
  T(1, 'Tailor Made Seasonal', 'family · 5 slides', 'all', '214', '11,7 M€', '1 outlier', ''),
  T(2, 'Seasonal Visibility: HB & LB', '', 'ITALY', '19', '554,5K', '1 outlier', 'CMO / CFO Review'),
  T(1, 'Tailor Made Permanent', 'family · 28 slides', 'all', '186', '6,4 M€', 'clean', ''),
  T(1, 'Coop Advertising', 'family · 24 slides', 'FR · DACH · NORTH', '142', '6,3 M€', 'clean', ''),
  T(1, 'In-store / Consumer Activation', 'family · 19 slides', 'all', '124', '4,2 M€', '1 flagged', ''),
  T(0, 'LENSES', 'category', '7 clusters', '412', '14,3 M€', '1 flagged', ''),
  T(1, 'Essilor Experts Partner Program', 'family · 32 slides', 'FR · IT · EAST', '198', '6,3 M€', 'clean', ''),
  T(1, 'Lens Activation', 'family · 50 slides', 'all', '128', '5,2 M€', '1 flagged', ''),
  T(0, 'COMMERCIAL EVENTS', 'category', 'EMEA + APAC', '94', '1,4 M€', 'clean', ''),
]

/* ── 2b · deck-order rail ────────────────────────────────────────────── */
type RKind = 'divider' | 'overview' | 'loa'
type RState = 'done' | 'live' | 'back' | 'todo'
const R = (kind: RKind, thumbLabel: string, label: string, meta: string, state: RState) => ({
  thumbLabel, label, meta,
  pad: kind === 'loa' ? '5px 7px' : '6px 7px',
  bg: state === 'live' ? C.cream : 'transparent',
  border: state === 'live' ? `1px solid ${C.gold}` : '1px solid transparent',
  thumbBg: kind === 'divider' ? C.ink : kind === 'overview' ? C.navy2 : '#FFFFFF',
  thumbBd: kind === 'loa' ? C.borderStrong : 'transparent',
  thumbFg: kind === 'loa' ? C.t2 : '#FFFFFF',
  font: kind === 'loa' ? `500 10.5px ${FONT.sans}` : `700 10.5px ${FONT.sans}`,
  fg: kind === 'loa' ? C.ink : kind === 'divider' ? C.ink : C.navy2,
  dot: state === 'done' ? C.success : state === 'live' ? C.gold : state === 'back' ? C.dangerDeep : C.border,
})
export const deckRail = [
  R('divider', 'COVER', 'Cover', 'validation session', 'done'),
  R('divider', 'FRAMES', 'FRAMES', 'category divider', 'done'),
  R('overview', 'OVW', 'Key investments priorities', '34,1 M€ · generated', 'done'),
  R('divider', 'TM', 'Tailor Made SEASONAL', 'family divider', 'done'),
  R('overview', 'OVW', 'Family overview', '11,7 M€ · donut', 'done'),
  R('loa', 'FR', 'Seasonal Vis.: OO, OW & RB', 'France · 280,0K', 'done'),
  R('loa', 'IT', 'Seasonal Vis.: All brands', 'Italy · 69,0K', 'done'),
  R('loa', 'IT', 'Digital Window Monobrand HB', 'Italy · 247,6K', 'back'),
  R('loa', 'IT', 'Seasonal Vis.: HB & LB (1/2)', 'Italy · 554,5K', 'live'),
  R('loa', 'IT', 'Seasonal Vis.: HB & LB (2/2)', 'continued', 'todo'),
  R('loa', 'IT', 'STL set up LB (1/2)', 'Italy · 218,3K', 'todo'),
  R('divider', 'TM', 'Tailor Made PERMANENT', 'family divider', 'todo'),
  R('overview', 'OVW', 'Family overview', '6,4 M€ · donut', 'todo'),
  R('loa', 'FR', 'Permanent Vis.: RB & OO', 'France · 270,0K', 'todo'),
]

/* ── 2b · template slide rows ────────────────────────────────────────── */
export const tplRows = [
  { brand: 'HB - Ray-Ban', cot: 'Top', doors: '240', avg: '500 €', q3: '120.000', bg: '#FDF3F3' },
  { brand: 'LB - Prada', cot: 'Top', doors: '120', avg: '450 €', q3: '54.000', bg: 'transparent' },
  { brand: 'LB - Versace', cot: 'Top', doors: '90', avg: '450 €', q3: '40.500', bg: 'transparent' },
  { brand: 'LB - Emporio Armani', cot: 'All', doors: '130', avg: '500 €', q3: '40.000', bg: 'transparent' },
  { brand: 'LB - Miu Miu', cot: 'Top', doors: '90', avg: '444 €', q3: '40.000', bg: 'transparent' },
  { brand: 'HB - Persol', cot: 'Icon', doors: '80', avg: '450 €', q3: '36.000', bg: 'transparent' },
  { brand: 'LB - Dolce & Gabbana', cot: 'Top', doors: '70', avg: '450 €', q3: '31.500', bg: 'transparent' },
  { brand: 'HB - Vogue', cot: 'All', doors: '60', avg: '450 €', q3: '27.000', bg: 'transparent' },
]

/* ── 2b · comment-on-a-line chips ────────────────────────────────────── */
export const lineComments = [
  { brand: 'HB - Ray-Ban', amt: '120.000 €', tag: '1 comment', tagBg: C.dangerBg2, tagFg: C.dangerDeep, bd: C.gold, bg: C.subtle },
  { brand: 'LB - Prada', amt: '54.000 €', tag: 'ok', tagBg: C.successBg, tagFg: C.success, bd: C.border, bg: '#FFFFFF' },
  { brand: 'LB - Versace', amt: '40.500 €', tag: 'ok', tagBg: C.successBg, tagFg: C.success, bd: C.border, bg: '#FFFFFF' },
  { brand: '+ 16 more lines', amt: '340.000 €', tag: 'ok', tagBg: C.cream, tagFg: C.t2, bd: C.border, bg: '#FFFFFF' },
]

/* ── 2c · excel filter chips + rows ──────────────────────────────────── */
export const excelFilters = [
  { label: 'Category: Frames' }, { label: 'Cluster: all' }, { label: 'Activity: all' },
  { label: 'Status: in session' }, { label: 'Flagged only' },
]

const EDEC: Record<string, [string, string]> = {
  'Approved': [C.ink, C.inkText], 'Rejected': [C.dangerBg, C.danger],
  'CMO / CFO Review': ['#F5EBD6', C.warnMid], '': ['transparent', 'transparent'],
}
const E = (
  lvl: number, name: string, country: string, activity: string, cot: string, customer: string,
  brand: string, doors: string, perDoor: string, vendor: string, q3: string, q4: string, total: string, dec: string,
) => ({
  name, country, activity, cot, customer, brand, doors, perDoor, vendor, q3, q4, total, dec,
  indent: (8 + lvl * 14) + 'px',
  bg: lvl === 0 ? C.cream : lvl === 1 ? C.subtle : lvl === 3 ? '#FBF9F4' : '#FFFFFF',
  bd: lvl <= 1 ? C.borderStrong : C.borderSoft,
  font: lvl === 0 ? `700 11px ${FONT.sans}` : lvl === 1 ? `600 11px ${FONT.sans}`
    : lvl === 3 ? `600 10.5px ${FONT.sans}` : `400 10.5px ${FONT.sans}`,
  fg: C.ink,
  chev: lvl === 0 ? '▾' : lvl === 1 ? '▾' : '',
  doorFg: perDoor === '500' ? C.dangerDeep : C.t2,
  decBg: (EDEC[dec] || EDEC[''])[0], decFg: (EDEC[dec] || EDEC[''])[1],
})
export const excelRows = [
  E(0, 'FRAMES', '', '', '', '', '742 lines', '9 840', '404', '', '10,2 M', '8,2 M', '18,4 M€', ''),
  E(1, 'Tailor Made Seasonal', '', '', '', '', '214 lines', '4 210', '441', '', '7,1 M', '4,6 M', '11,7 M€', ''),
  E(2, 'LOA #45688 · Seasonal Vis.: OO, OW & RB', 'France', 'TM Seasonal', 'Top', 'All / Icon', '2 brands', '700', '400', 'ELBA', '280.000', '—', '280.000', 'Approved'),
  E(2, 'LOA #45690 · Seasonal Vis.: HB & LB', 'Italy', 'TM Seasonal', 'Top', 'Top Loc, Stars', '19 brands', '1 222', '453', 'Vetrina In', '554.500', '—', '554.500', 'CMO / CFO Review'),
  E(3, 'HB - Ray-Ban', 'Italy', 'TM Seasonal', 'Top', 'Top Loc, Stars', 'HB - Ray-Ban', '240', '500', 'Vetrina In', '120.000', '—', '120.000', ''),
  E(3, 'LB - Prada', 'Italy', 'TM Seasonal', 'Top', 'Top Loc, Stars', 'LB - Prada', '120', '450', 'Vetrina In', '54.000', '—', '54.000', ''),
  E(3, 'LB - Versace', 'Italy', 'TM Seasonal', 'Top', 'Top Loc, Stars', 'LB - Versace', '90', '450', 'Vetrina In', '40.500', '—', '40.500', ''),
  E(3, 'LB - Emporio Armani', 'Italy', 'TM Seasonal', 'All', 'Top Loc, Stars', 'LB - Emporio Armani', '130', '500', 'Vetrina In', '40.000', '—', '40.000', ''),
  E(3, '+ 15 more brand lines', 'Italy', 'TM Seasonal', '—', 'Top Loc, Stars', '15 brands', '642', '~440', 'Vetrina In', '300.000', '—', '300.000', ''),
  E(2, 'LOA #45691 · Digital Window Monobrand LB', 'Italy', 'TM Seasonal', 'Top', 'Top Loc, DoM', '19 brands', '396', '455', 'Factory Group', '180.000', '—', '180.000', 'CMO / CFO Review'),
  E(2, 'LOA #45692 · High Visibility LBs', 'Italy', 'TM Seasonal', 'Top', 'Rinascente +', '6 brands', '26', '8 396', 'Vetrina In', '218.300', '—', '218.300', 'Rejected'),
  E(1, 'Tailor Made Permanent', '', '', '', '', '186 lines', '2 980', '2 148', '', '3,4 M', '3,0 M', '6,4 M€', ''),
  E(2, 'LOA #45702 · Permanent Vis.: RB & OO', 'France', 'TM Permanent', 'Top', 'Stars, DoM', '2 brands', '200', '1 350', 'Vetrina In', '270.000', '—', '270.000', 'Approved'),
  E(1, 'Coop Advertising', '', '', '', '', '142 lines', '1 480', '4 257', '', '3,9 M', '2,4 M', '6,3 M€', ''),
  E(2, 'LOA #45718 · Afflelou & Optical Center', 'France', 'Coop ADV', '—', 'Afflelou, OC', '4 brands', '780', '1 025', 'Havas', '480.000', '320.000', '800.000', 'CMO / CFO Review'),
  E(1, 'In-store / Consumer Activation', '', '', '', '', '124 lines', '1 170', '3 590', '', '2,6 M', '1,6 M', '4,2 M€', ''),
  E(2, 'LOA #45744 · In-store Activation: All HB & LB', 'Spain', 'In-store', '—', 'Selected clients', '7 brands', '695', '115', 'Assai / DUPS', '42.000', '40.000', '82.000', 'CMO / CFO Review'),
  E(0, 'LENSES', '', '', '', '', '412 lines', '4 780', '2 992', '', '9,2 M', '5,1 M', '14,3 M€', ''),
  E(1, 'Essilor Experts Partner Program', '', '', '', '', '198 lines', '2 240', '2 812', '', '4,1 M', '2,2 M', '6,3 M€', ''),
  E(2, 'LOA #45693 · Roll out Italy Lab: Varilux Wave 2', 'Italy', '3 activities', 'All', 'EE / EC / EL', 'Essilor Varilux', '240', '1 754', 'GDP / Altavia', '150.000', '271.000', '421.000', 'CMO / CFO Review'),
]

/* ── 2d · LOA creation ───────────────────────────────────────────────── */
export const headerFields = [
  { label: 'Cluster', value: 'ITALY', bd: C.border, hint: '' },
  { label: 'Country', value: 'Italy', bd: C.border, hint: 'Filters from cluster' },
  { label: 'Category', value: 'Frames', bd: C.border, hint: '' },
  { label: 'Primary activity type', value: 'Tailor Made Seasonal', bd: C.gold, hint: 'Files the slide in this section' },
  { label: 'Channel of trade', value: 'Top Loc, Stars, DoM', bd: C.border, hint: 'COT' },
]
export const createLines = [
  { activity: 'TM Seasonal', brand: 'HB - Ray-Ban', detail: 'STL set up', doors: '240', perDoor: '500', vendor: 'Vetrina In', total: '120.000', bg: '#FFFFFF', actFg: C.t2, actWeight: '400' },
  { activity: 'TM Seasonal', brand: 'LB - Prada', detail: 'STL set up', doors: '120', perDoor: '450', vendor: 'Vetrina In', total: '54.000', bg: '#FFFFFF', actFg: C.t2, actWeight: '400' },
  { activity: 'TM Seasonal', brand: 'LB - Versace', detail: 'STL set up', doors: '90', perDoor: '450', vendor: 'Vetrina In', total: '40.500', bg: '#FFFFFF', actFg: C.t2, actWeight: '400' },
  { activity: 'TM Seasonal', brand: 'LB - Emporio Armani', detail: 'STL set up', doors: '130', perDoor: '500', vendor: 'Vetrina In', total: '40.000', bg: '#FFFFFF', actFg: C.t2, actWeight: '400' },
  { activity: 'TM Seasonal', brand: 'LB - Miu Miu', detail: 'STL set up', doors: '90', perDoor: '444', vendor: 'Vetrina In', total: '40.000', bg: '#FFFFFF', actFg: C.t2, actWeight: '400' },
  { activity: 'Trade Incentive', brand: 'HB - Ray-Ban', detail: 'Sell-out bonus', doors: '240', perDoor: '85', vendor: 'GDP', total: '20.400', bg: C.subtle, actFg: C.gold, actWeight: '600' },
  { activity: 'Trade Incentive', brand: 'LB - Prada', detail: 'Sell-out bonus', doors: '120', perDoor: '85', vendor: 'GDP', total: '10.200', bg: C.subtle, actFg: C.gold, actWeight: '600' },
  { activity: 'In-store', brand: 'HB - Persol', detail: 'Consumer event', doors: '80', perDoor: '250', vendor: 'Altavia', total: '20.000', bg: C.subtle, actFg: C.gold, actWeight: '600' },
  { activity: 'In-store', brand: 'HB - Vogue', detail: 'Consumer event', doors: '60', perDoor: '250', vendor: 'Altavia', total: '15.000', bg: C.subtle, actFg: C.gold, actWeight: '600' },
]
const chip = (label: string, on: boolean) => ({ label, bg: on ? C.ink : '#FFFFFF', fg: on ? C.inkText : C.t2, bd: on ? C.ink : C.border })
export const brandGroups = [chip('All HB', false), chip('All LB', true), chip('All HB + LB', false), chip('Luxury', false), chip('RB + RB Meta', false)]
export const brandPills = ['HB - Ray-Ban', 'HB - Persol', 'HB - Vogue', 'LB - Prada', 'LB - Miu Miu', 'LB - Versace', 'LB - Emporio Armani', 'LB - Dolce & Gabbana'].map(label => ({ label }))
const opt = (label: string, on: boolean, hint: string) => ({
  label, hint, bg: on ? C.cream : 'transparent',
  boxBd: on ? C.gold : C.borderStrong, boxBg: on ? C.gold : 'transparent', check: on ? '✓' : '',
})
export const brandOptions = [opt('HB - Ray-Ban', true, 'RB'), opt('HB - Oakley', false, 'OO'), opt('HB - Persol', true, 'PO')]

/* ── Gallery manifest (the dc-viewer turns / options) ────────────────── */
export interface Screen { id: string; label: string; href: string; w: number }
export interface Turn { id: string; title: string; screens: Screen[]; tryNext: string }
export const TURNS: Turn[] = [
  {
    id: '3', title: 'Admin console rebuilt around the real approval chain — plus emergency cycles and the submit/confirm pattern',
    screens: [
      { id: '3a', label: 'Admin as one screen — the cycle is the dashboard. Everything an admin does, no tabs', href: '/design/admin', w: 1440 },
      { id: '3b', label: 'Start emergency cycle — dates + the marketers authorised to create in it', href: '/design/admin-emergency', w: 640 },
      { id: '3c', label: 'Submit & confirm — every role finishes their pass explicitly, nothing is submitted by accident', href: '/design/admin-submit', w: 760 },
    ],
    tryNext: 'build 3a out with the People and Audit screens behind it · add the IA-code minting step to 3a · show the marketer’s version of 3c',
  },
  {
    id: '2', title: 'One review surface for everyone — Tracker with a Review Mode toggle, built on the real deck hierarchy',
    screens: [
      { id: '2a', label: 'Tracker = the review page. Deck hierarchy as the spine, one toggle switches List / Deck / Excel', href: '/design/tracker', w: 1440 },
      { id: '2b', label: 'Deck view — slide rebuilt to the exact template, filmstrip walks the real deck order', href: '/design/tracker-deck', w: 1440 },
      { id: '2c', label: 'Excel view for the CFO — the same session as a spreadsheet, hierarchy kept as grouped rows', href: '/design/tracker-excel', w: 1440 },
      { id: '2d', label: 'LOA creation — multi-brand and multi-activity line editor', href: '/design/loa-create', w: 1440 },
    ],
    tryNext: 'make 2a the only page and drop the separate review pages · in 2c let the CFO edit numbers inline · show 2b in present mode',
  },
  {
    id: '1', title: 'CMO review, rebuilt around the real LOA deck — three directions',
    screens: [
      { id: '1a', label: 'Deck Session — slide-first, comments pinned to the slide zone (interactive)', href: '/design/cmo-deck', w: 1440 },
      { id: '1b', label: 'One at a time — queue flow, running total, keyboard-driven', href: '/design/cmo-queue', w: 1440 },
      { id: '1c', label: 'Portfolio first — the session opens on the money, then drills into slides', href: '/design/cmo-portfolio', w: 1440 },
      { id: '1d', label: 'State · Present mode — projected in the room, chrome collapses to a pill', href: '/design/cmo-present', w: 1180 },
      { id: '1e', label: 'State · Session complete — the minutes write themselves', href: '/design/cmo-complete', w: 1180 },
    ],
    tryNext: 'add the zone-comment flow to the tracker page too · merge 1c’s triage into 1a as the session opening screen · show 1a with the CFO’s budget column',
  },
]
