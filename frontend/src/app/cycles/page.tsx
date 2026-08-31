'use client'
/**
 * /cycles — the folder page (Night Lens). The single entry point for the product.
 *
 * Every role that lands anywhere lands here first, admin included. Admin is not
 * a different application: it is this page plus wider permissions plus the Admin
 * Console in the ⊙⊙ menu.
 *
 * This page contains NO role→template logic. It asks `resolveFolderOpen()` what
 * to do and does it. That function and `allowedTemplates()` in lib/roles.ts are
 * the only places a role→template rule exists, which is what keeps the chooser
 * and the route guard from ever disagreeing.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NightLensPage from '@/components/NightLensPage'
import EmeaViewChooser from '@/components/cycles/EmeaViewChooser'
import { readCycleView, rememberCycleView } from '@/components/cycles/cycleViewChoice'
import { useMyRole } from '@/hooks/usePermissions'
import { interfaceFor, allowedTemplates, soleTemplate, canRememberTemplate, type Template } from '@/lib/roles'
import { resolveFolderOpen, templateHref } from '@/lib/routes'

export default function CyclesPage() {
  const router = useRouter()
  const { role, loading } = useMyRole()
  const [pending, setPending] = useState<{ id: string; name: string; templates: readonly Template[] } | null>(null)

  const iface = interfaceFor(role?.role_code, role?.can_override_lock === true)
  const isAdmin = iface === 'admin'

  const openCycle = (cycleId: string, cycleName: string) => {
    const outcome = resolveFolderOpen(iface, cycleId, readCycleView(cycleId))
    if (outcome.kind === 'route') { router.push(outcome.href); return }
    setPending({ id: cycleId, name: cycleName, templates: outcome.templates })
  }

  /**
   * NightLensPage predates the template set and takes a two-value `role` prop
   * only to pick its copy (deck wording vs sheet wording). Derive it from the
   * templates rather than re-testing the role, so there is no second switch.
   */
  const copyRole = allowedTemplates(iface).length === 1 && soleTemplate(iface) === 'sheet'
    ? 'cfo'
    : 'cmo'

  return (
    <>
      <NightLensPage
        role={copyRole}
        userName={role?.full_name || role?.email || null}
        isAdmin={isAdmin}
        onEnterCycle={(cycleId, cycleName) => openCycle(cycleId, cycleName)}
      />

      {pending && (
        <EmeaViewChooser
          cycleName={pending.name}
          templates={pending.templates}
          canRemember={canRememberTemplate(iface)}
          onCancel={() => setPending(null)}
          onPick={(template, remember) => {
            if (remember) rememberCycleView(pending.id, template)
            const href = templateHref(pending.id, template)
            setPending(null)
            router.push(href)
          }}
        />
      )}

      {loading && <span className="la-sr-only">Loading your role…</span>}
    </>
  )
}
