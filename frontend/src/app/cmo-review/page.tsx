'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CmoReviewIndex() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/?view=review')
  }, [router])
  return null
}
