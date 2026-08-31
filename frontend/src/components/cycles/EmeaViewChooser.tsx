'use client'
/**
 * The review-template chooser — asked when a role has more than one allowed
 * template (EMEA, and now Admin with all three).
 *
 * This component knows nothing about roles. It renders the options it is handed
 * and reports which one was picked; the caller decides what to offer by reading
 * `allowedTemplates()` in lib/roles.ts. This file imports only the template
 * vocabulary (lib/templates), never the role rules — that is deliberate, and the reason
 * there is one chooser rather than one per role.
 *
 * All user-facing copy comes from `TEMPLATE_COPY` in lib/templates.ts and is
 * verbatim from the spec. Do not reword it here.
 *
 * The remembered choice is per cycle (see cycleViewChoice.ts). Once remembered,
 * /cycles routes straight through for that cycle; the user can still change view
 * from inside it via CycleViewFrame.
 */
import { useEffect, useRef, useState } from 'react'
import { TEMPLATE_COPY, type Template } from '@/lib/templates'

export default function EmeaViewChooser({
  cycleName,
  templates,
  onPick,
  onCancel,
  canRemember = true,
}: {
  cycleName: string
  /** The options to offer, in order. Supplied by the caller, never derived here. */
  templates: readonly Template[]
  onPick: (template: Template, remember: boolean) => void
  onCancel: () => void
  /** When false the choice cannot be persisted, so the checkbox is not offered. */
  canRemember?: boolean
}) {
  const [remember, setRemember] = useState(false)
  const firstRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="la-chooser-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="la-chooser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="la-chooser-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="la-chooser-title" className="la-chooser-title">
          How would you like to review this cycle?
        </h2>
        <p className="la-chooser-sub">{cycleName}</p>

        <div className="la-chooser-options">
          {templates.map((t, i) => (
            <button
              key={t}
              ref={i === 0 ? firstRef : undefined}
              className="la-chooser-option"
              onClick={() => onPick(t, remember)}
            >
              <span className="la-chooser-option-title">{TEMPLATE_COPY[t].title}</span>
              <span className="la-chooser-option-dash" aria-hidden="true">—</span>
              <span className="la-chooser-option-blurb">{TEMPLATE_COPY[t].blurb}</span>
            </button>
          ))}
        </div>

        {canRemember ? (
          <label className="la-chooser-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
            />
            <span>Remember my choice for this cycle</span>
          </label>
        ) : (
          <p className="la-chooser-remember">
            <span>You are asked every time — pick whichever lens fits what you are checking.</span>
          </p>
        )}
      </div>
    </div>
  )
}
