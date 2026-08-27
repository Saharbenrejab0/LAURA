'use client'
/**
 * /cfo-review is no longer a separate page. The Tracker IS the review surface:
 * the CFO reviews the cycle in the Excel view. Redirect there.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CfoReviewPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/?view=excel') }, [router])
  return null
}
