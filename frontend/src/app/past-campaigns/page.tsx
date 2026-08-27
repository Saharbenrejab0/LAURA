'use client'

/**
 * `/past-campaigns` → Campaign Library.
 *
 * This page was a template picker called "Past Campaigns", and its contents were
 * 99.4% imported client history (2,657 of 2,672 rows) with nothing on screen
 * saying so — it read `GET /templates`, which had no source filter at all. The
 * two things it conflated now live in the library as two labelled tabs.
 *
 * The route is kept as a redirect rather than deleted: it is in bookmarks, in
 * the old sidebar, and in links already sent to people.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'

export default function PastCampaignsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace(ROUTES.campaigns) }, [router])
  return <p className="la-lib-msg" style={{ padding: 28 }}>Opening the Campaign Library…</p>
}
