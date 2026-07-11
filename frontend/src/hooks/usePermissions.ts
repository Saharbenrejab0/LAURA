'use client'

import { useEffect, useState } from 'react'
import { getMyPermissionsOnLOA, getMyRole } from '@/lib/api'

export interface LOAPermissions {
  loa_id: string
  user_role: string
  user_email: string
  loa_status: string
  is_scope_match: boolean
  is_author: boolean
  can_view: boolean
  can_edit: boolean
  can_comment: boolean
  can_validate: boolean
  can_delete: boolean
  can_duplicate: boolean
  can_override_lock: boolean
}

export interface UserRole {
  user_id: number
  email: string
  full_name: string
  role_code: string | null
  role_display_name: string | null
  role_scope_type: string | null
  role_scope_value: string[] | null
  can_override_lock: boolean
}

/**
 * usePermissions — fetches the current user's permissions for a specific LOA.
 *
 * Returns:
 *   - permissions: the permission flags (or null while loading or on error)
 *   - loading: true while the fetch is in progress
 *   - error: any error encountered (null if success)
 *   - refresh: function to re-fetch (e.g. after a status change)
 *
 * Example:
 *   const { permissions, loading } = usePermissions(loaId)
 *   if (permissions?.can_edit) { ... }
 */
export function usePermissions(loaId: string | null | undefined) {
  const [permissions, setPermissions] = useState<LOAPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPermissions = async () => {
    if (!loaId) {
      setPermissions(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getMyPermissionsOnLOA(loaId)
      setPermissions(data)
    } catch (err: any) {
      setError(err)
      setPermissions(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [loaId])

  return {
    permissions,
    loading,
    error,
    refresh: fetchPermissions,
  }
}

/**
 * useMyRole — fetches and caches the current user's role info.
 * Used in app shell (header, login redirect, etc.)
 */
export function useMyRole() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchRole = async () => {
      try {
        const data = await getMyRole()
        if (!cancelled) setRole(data)
      } catch (err: any) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRole()
    return () => {
      cancelled = true
    }
  }, [])

  return { role, loading, error }
}
