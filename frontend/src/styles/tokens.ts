/**
 * LAURA — Design tokens (Black & White luxe + Champagne)
 *
 * All color paths now reference CSS variables defined in styles/theme.css.
 * Light/dark mode is handled by toggling `.dark` on <html>.
 *
 * All existing imports (color.bg.canvas, color.action.primary, etc.) still work
 * — they just resolve to the correct theme value at render time.
 */

export const color = {
  bg: {
    canvas:  'var(--laura-bg-canvas)',
    surface: 'var(--laura-bg-surface)',
    warm:    'var(--laura-bg-warm)',
    subtle:  'var(--laura-bg-subtle)',
    tint:    'var(--laura-bg-tint)',
    lensMist:'var(--laura-bg-laura-mist)',
    elevated:'var(--laura-bg-elevated)',
  },
  border: {
    soft:   'var(--laura-border-soft)',
    strong: 'var(--laura-border-strong)',
  },
  text: {
    primary:   'var(--laura-text-primary)',
    secondary: 'var(--laura-text-secondary)',
    tertiary:  'var(--laura-text-tertiary)',
    onPrimary: 'var(--laura-text-on-primary)',
    onInk:     'var(--laura-text-on-primary)',
  },
  ink:     'var(--laura-action)',          // legacy alias = primary action
  graphite:'var(--laura-action-hover)',
  action: {
    primary:      'var(--laura-action)',
    primaryHover: 'var(--laura-action-hover)',
    primaryTint:  'var(--laura-bg-tint)',
    ink:          'var(--laura-action)',
    inkHover:     'var(--laura-action-hover)',
  },
  /* Champagne accents — what used to be "lens.blue" now points to champagne. */
  lens: {
    blue: 'var(--laura-champagne)',
    mist: 'var(--laura-champagne-mist)',
    iris: 'var(--laura-champagne-deep)',
  },
  accent: {
    gold:           'var(--laura-champagne)',
    blue:           'var(--laura-info)',    // legacy info → muted warm grey
    champagne:      'var(--laura-champagne)',
    champagneDeep:  'var(--laura-champagne-deep)',
    champagneMist:  'var(--laura-champagne-mist)',
  },
  status: {
    success:  'var(--laura-success)',
    warning:  'var(--laura-warning)',
    danger:   'var(--laura-danger)',
    dangerBg: 'var(--laura-danger-bg)',
  },
} as const;

/**
 * Status badges - reference CSS vars so they invert with the theme.
 * Labels remain static strings.
 */
export const statusBadge = {
  draft:             { text: 'var(--laura-text-secondary)', bg: 'var(--laura-bg-subtle)',    border: 'var(--laura-border-soft)',     label: 'Draft' },
  emea_review:       { text: 'var(--laura-info)',            bg: 'var(--laura-info-bg)',      border: 'var(--laura-info-border)',     label: 'EMEA review' },
  global_review:     { text: 'var(--laura-info)',            bg: 'var(--laura-info-bg)',      border: 'var(--laura-info-border)',     label: 'Global review' },
  global_functions:  { text: 'var(--laura-info)',            bg: 'var(--laura-info-bg)',      border: 'var(--laura-info-border)',     label: 'Global functions' },
  cmo_cfo_review:    { text: 'var(--laura-champagne-deep)',  bg: 'var(--laura-champagne-mist)', border: 'var(--laura-champagne-border)', label: 'CMO/CFO review' },
  corporate_review:  { text: 'var(--laura-champagne-deep)',  bg: 'var(--laura-champagne-mist)', border: 'var(--laura-champagne-border)', label: 'Corporate review' },
  approved:          { text: 'var(--laura-text-on-primary)', bg: 'var(--laura-action)',       border: 'var(--laura-action)',          label: 'Approved' },
  rejected:          { text: 'var(--laura-danger)',          bg: 'var(--laura-danger-bg)',    border: 'var(--laura-danger-border)',   label: 'Rejected' },
  closed:            { text: 'var(--laura-text-secondary)',  bg: 'var(--laura-bg-subtle)',    border: 'var(--laura-border-soft)',     label: 'Closed' },
} as const;

export const originBadge = {
  draftPhase:  { text: 'var(--laura-champagne-deep)', bg: 'var(--laura-champagne-mist)', border: 'var(--laura-champagne-border)' },
  reviewPhase: { text: 'var(--laura-text-secondary)', bg: 'var(--laura-bg-subtle)',      border: 'var(--laura-border-soft)' },
} as const;

export const font = {
  sans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"IBM Plex Mono", "SF Mono", Menlo, Consolas, monospace',
} as const;

export const type = {
  display:     { size: 32, line: 40, weight: 600 },
  h1:          { size: 24, line: 32, weight: 600 },
  h2:          { size: 18, line: 26, weight: 600 },
  h3:          { size: 15, line: 22, weight: 600 },
  body:        { size: 14, line: 22, weight: 400 },
  bodyStrong:  { size: 14, line: 22, weight: 560 },
  small:       { size: 12, line: 18, weight: 400 },
  monoSmall:   { size: 12, line: 18, weight: 500 },
  monoMatch:   { size: 28, line: 32, weight: 500 },
} as const;

export const space = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

export const radius = {
  field: 10,
  card:  14,
  pill:  999,
  modal: 16,
} as const;

export const motion = {
  duration: { quick: 120, base: 180, slow: 260 },
  easing:   'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const layout = {
  sidebarExpanded:  248,
  sidebarCollapsed: 68,
  contentMax:       1280,
  draftColumn:      840,
  insightRail:      320,
  topBarHeight:     0,        // header is now invisible
} as const;

export const shadow = {
  modal:   '0 24px 64px rgba(10, 10, 10, 0.14), 0 4px 16px rgba(10, 10, 10, 0.08)',
  popover: '0 8px 24px rgba(10, 10, 10, 0.08)',
  fab:     '0 4px 14px rgba(10, 10, 10, 0.18)',
} as const;

export const fontFaceImport =
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;560;600&family=IBM+Plex+Mono:wght@400;500&display=swap');";
