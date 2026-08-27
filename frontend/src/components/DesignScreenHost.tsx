'use client'
/**
 * Hosts a full-page design screen on a REAL app route (outside /design).
 * Injects the design system's font + interaction CSS (JetBrains Mono, pins,
 * zones, filmstrip, buttons) and provides a horizontal-scroll container so
 * fixed-width design layouts stay usable on narrow viewports.
 *
 * Used by /cmo-review and /cfo-review, which render the finished design screens.
 */
const DC_CSS = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
.dc-host{min-height:100vh;background:#F6F4EF;overflow-x:auto;font-family:'DM Sans',system-ui,sans-serif;color:#1A1815}
.dc-host *{box-sizing:border-box}
.dc-zone{position:absolute;border-radius:4px;cursor:pointer;transition:background .12s,box-shadow .12s}
.dc-zone:hover{background:rgba(176,141,47,.14);box-shadow:0 0 0 1.5px rgba(176,141,47,.55)}
.dc-pin{position:absolute;width:19px;height:19px;border-radius:11px 11px 11px 2px;display:flex;align-items:center;justify-content:center;font:700 10px 'DM Sans',sans-serif;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.28)}
.dc-film{cursor:pointer;transition:transform .12s,border-color .12s}
.dc-film:hover{transform:translateY(-2px)}
.dc-btn{cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .14s ease}
.dc-btn:hover{filter:brightness(.98)}`

export default function DesignScreenHost({ children }: { children: React.ReactNode }) {
  return (
    <div className="dc-host">
      <style dangerouslySetInnerHTML={{ __html: DC_CSS }} />
      {children}
    </div>
  )
}
