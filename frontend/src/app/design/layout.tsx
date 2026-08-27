/**
 * LAURA — Design-doc route layout
 * -----------------------------------------------------------------------------
 * Renders bare (AppShell bypasses "/design"), on the warm stage background the
 * Claude design doc used (#EDEAE3). Loads JetBrains Mono for the monospace
 * identifiers; DM Sans + Cormorant Garamond already load globally via
 * globals.css. Every screen under here is a fixed-width, pixel-faithful card.
 */

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
.dc-stage{background:#EDEAE3;min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;color:#1A1815}
.dc-stage *{box-sizing:border-box}
.dc-stage a{color:#B08D2F;text-decoration:none}
.dc-stage a:hover{color:#1A1815}
.dc-zone{position:absolute;border-radius:4px;cursor:pointer;transition:background .12s,box-shadow .12s}
.dc-zone:hover{background:rgba(176,141,47,.14);box-shadow:0 0 0 1.5px rgba(176,141,47,.55)}
.dc-pin{position:absolute;width:19px;height:19px;border-radius:11px 11px 11px 2px;display:flex;align-items:center;justify-content:center;font:700 10px 'DM Sans',sans-serif;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.28)}
.dc-film{cursor:pointer;transition:transform .12s,border-color .12s}
.dc-film:hover{transform:translateY(-2px)}
.dc-btn{cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .14s ease}
.dc-btn:hover{filter:brightness(.98)}`

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dc-stage">
      <style dangerouslySetInnerHTML={{ __html: FONT_IMPORT }} />
      {children}
    </div>
  )
}
