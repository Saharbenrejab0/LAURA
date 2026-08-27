'use client'
/**
 * SplitPaneShell — the split-screen LAYOUT CONTRACT, in one place.
 *
 * What was duplicated between the per-LOA split-screen and the per-cycle "Both"
 * view was never the data — those are legitimately different scopes — it was
 * this contract, and it had already caused one bug:
 *
 *   - the page scrolls as ONE document (normal flow, not a fixed overlay)
 *   - the header region is sticky under the 56px TopNav
 *   - the action bar is FIXED to the bottom of the viewport, so a primary
 *     action can never scroll out of reach
 *   - the top pane scrolls on its own axis, the bottom pane on its own
 *   - neither pane sets `overscroll-behavior: contain`, so reaching a pane's
 *     end hands the wheel back to the page instead of trapping it
 *   - the collapse toggles are functional: they unmount a pane, and because the
 *     panes are height-bounded rather than flex-stretched, the surviving pane
 *     keeps its own scrolling either way
 *
 * This component knows nothing about LOAs, cycles, roles or permissions. It is
 * handed nodes and renders them. Anything that writes `overflow`,
 * `position: sticky` or `position: fixed` for the split layout belongs HERE,
 * not in a composition.
 */
import { forwardRef } from 'react'

export type CollapseState = 'none' | 'top' | 'bottom'

export interface SplitPaneShellProps {
  /** Sticky region under TopNav — title bars, steppers, banners. */
  header?: React.ReactNode
  /** Upper pane. Scrolls horizontally on its own axis. */
  top: React.ReactNode
  /** Lower pane. Scrolls vertically on its own axis. */
  bottom: React.ReactNode
  /** Fixed to the viewport bottom. Omit for a read-only surface with no actions. */
  actionBar?: React.ReactNode
  /** Rendered beside the panes, e.g. a comment drawer. */
  aside?: React.ReactNode
  /** Floats over the panes, e.g. a comment popover. */
  overlay?: React.ReactNode

  collapse?: CollapseState
  onCollapseChange?: (next: CollapseState) => void
  /** Labels for the two collapse controls. Hidden entirely when omitted. */
  collapseLabels?: { top: string; bottom: string }
}

/** Ref goes to the pane element, for callers that measure it. */
const SplitPaneShell = forwardRef<HTMLDivElement, SplitPaneShellProps>(function SplitPaneShell({
  header,
  top,
  bottom,
  actionBar,
  aside,
  overlay,
  collapse = 'none',
  onCollapseChange,
  collapseLabels,
}, paneRef) {
  const showToggles = Boolean(onCollapseChange && collapseLabels)

  // A shell with no action bar must not reserve room for one.
  const cls = actionBar ? 'la-ssr' : 'la-ssr la-ssr-noaction'

  return (
    <div className={cls}>
      {header && <div className="la-ssr-sticky">{header}</div>}

      <div className="la-ssr-body">
        <div ref={paneRef} className="la-ssr-pane">
          {collapse !== 'top' && top}

          {showToggles && (
            <div className="la-ssr-divider">
              <button
                type="button"
                className="la-ssr-divider-btn la-ssr-divider-left"
                aria-expanded={collapse !== 'top'}
                onClick={() => onCollapseChange!(collapse === 'top' ? 'none' : 'top')}
              >
                {collapse === 'top' ? `⌄ Expand ${collapseLabels!.top}` : `⌃ Collapse ${collapseLabels!.top}`}
              </button>
              <span className="la-ssr-divider-grip" aria-hidden="true" />
              <button
                type="button"
                className="la-ssr-divider-btn la-ssr-divider-right"
                aria-expanded={collapse !== 'bottom'}
                onClick={() => onCollapseChange!(collapse === 'bottom' ? 'none' : 'bottom')}
              >
                {collapse === 'bottom' ? `Expand ${collapseLabels!.bottom} ⌃` : `Collapse ${collapseLabels!.bottom} ⌄`}
              </button>
            </div>
          )}

          {collapse !== 'bottom' && bottom}

          {overlay}
        </div>

        {aside}
      </div>

      {actionBar && <div className="la-ssr-actionbar">{actionBar}</div>}
    </div>
  )
})

export default SplitPaneShell
