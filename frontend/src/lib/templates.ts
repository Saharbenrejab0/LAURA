/**
 * Review templates — the vocabulary, with no knowledge of roles.
 *
 * Split out of `roles.ts` so that consumers which only need to RENDER a template
 * (the chooser, the in-view switcher) depend on this, while the question of
 * *which* templates a role may use stays in `roles.ts`. The chooser should not
 * import from a module about roles, per "the chooser should not know about roles;
 * it should render the options it is handed".
 */

export type Template =
  | 'deck'    // PPT-style slideshow, one slide per LOA
  | 'sheet'   // Excel/spreadsheet grid, every line and total
  | 'split'   // Excel row on top, LOA slide below
  | 'list'    // plain list of the cycle's LOAs, the marketer's own view

export const ALL_TEMPLATES: readonly Template[] = ['deck', 'sheet', 'split', 'list'] as const

/**
 * Chooser copy, verbatim from the spec.
 *
 * `split` is labelled "Both" because at cycle scope that is what it is — the
 * sheet above and the slide below.
 */
export const TEMPLATE_COPY: Record<Template, { title: string; blurb: string }> = {
  deck:  { title: 'Deck',         blurb: 'one slide per LOA, presented in order' },
  sheet: { title: 'Budget sheet', blurb: 'every line and total in one grid' },
  split: { title: 'Both',         blurb: 'one LOA at a time — budget line on top, slide below' },
  list:  { title: 'List',         blurb: 'every LOA in the cycle, as a marketer sees theirs' },
}

export function isTemplate(v: unknown): v is Template {
  return typeof v === 'string' && (ALL_TEMPLATES as readonly string[]).includes(v)
}
