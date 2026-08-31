/**
 * Screen registry — maps each design-doc option to its React component + native
 * width, keyed by URL slug. Consumed by the gallery (design/page.tsx) and the
 * per-screen route (design/[screen]/page.tsx).
 */
import type { ComponentType } from 'react'
import CmoDeck from './CmoDeck'
import CmoQueue from './CmoQueue'
import CmoPortfolio from './CmoPortfolio'
import CmoPresent from './CmoPresent'
import CmoComplete from './CmoComplete'
import Tracker from './Tracker'
import TrackerDeck from './TrackerDeck'
import TrackerExcel from './TrackerExcel'
import LoaCreate from './LoaCreate'
import Admin from './Admin'
import AdminEmergency from './AdminEmergency'
import AdminSubmit from './AdminSubmit'

export interface Entry { id: string; w: number; Component: ComponentType }

export const REGISTRY: Record<string, Entry> = {
  'cmo-deck': { id: '1a', w: 1440, Component: CmoDeck },
  'cmo-queue': { id: '1b', w: 1440, Component: CmoQueue },
  'cmo-portfolio': { id: '1c', w: 1440, Component: CmoPortfolio },
  'cmo-present': { id: '1d', w: 1180, Component: CmoPresent },
  'cmo-complete': { id: '1e', w: 1180, Component: CmoComplete },
  'tracker': { id: '2a', w: 1440, Component: Tracker },
  'tracker-deck': { id: '2b', w: 1440, Component: TrackerDeck },
  'tracker-excel': { id: '2c', w: 1440, Component: TrackerExcel },
  'loa-create': { id: '2d', w: 1440, Component: LoaCreate },
  'admin': { id: '3a', w: 1440, Component: Admin },
  'admin-emergency': { id: '3b', w: 640, Component: AdminEmergency },
  'admin-submit': { id: '3c', w: 760, Component: AdminSubmit },
}

export const slugFromHref = (href: string) => href.split('/').pop() as string
