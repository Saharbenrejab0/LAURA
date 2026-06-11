'use client'

import { ReactNode } from 'react'
import { LOAPermissions } from '@/hooks/usePermissions'

type PermissionAction = 'view' | 'edit' | 'comment' | 'validate' | 'override_lock'

interface PermissionGuardProps {
  /** The permissions object returned by usePermissions hook */
  permissions: LOAPermissions | null
  /** What action does the user need to be able to do? */
  action: PermissionAction
  /** What to render if the user HAS the permission */
  children: ReactNode
  /** Optional: what to render if the user DOESN'T have the permission */
  fallback?: ReactNode
  /** Optional: render nothing while permissions are loading */
  hideWhileLoading?: boolean
  /** Optional: pass loading state from usePermissions */
  loading?: boolean
}

/**
 * PermissionGuard — declaratively show/hide UI based on user permissions.
 *
 * Examples:
 *
 *   // Show edit button only if user can edit
 *   <PermissionGuard permissions={perms} action="edit">
 *     <button>Edit</button>
 *   </PermissionGuard>
 *
 *   // Show a different message when user cannot validate
 *   <PermissionGuard
 *     permissions={perms}
 *     action="validate"
 *     fallback={<p>Waiting for approver action</p>}
 *   >
 *     <button>Approve</button>
 *     <button>Reject</button>
 *   </PermissionGuard>
 *
 *   // Combined with loading state
 *   const { permissions, loading } = usePermissions(loaId)
 *   <PermissionGuard
 *     permissions={permissions}
 *     loading={loading}
 *     action="edit"
 *     hideWhileLoading
 *   >
 *     <EditButton />
 *   </PermissionGuard>
 */
export default function PermissionGuard({
  permissions,
  action,
  children,
  fallback = null,
  hideWhileLoading = false,
  loading = false,
}: PermissionGuardProps) {
  // While loading, optionally hide content (avoid permission flash)
  if (loading) {
    return hideWhileLoading ? null : <>{children}</>
  }

  if (!permissions) {
    return <>{fallback}</>
  }

  const hasPermission = (() => {
    switch (action) {
      case 'view':          return permissions.can_view
      case 'edit':          return permissions.can_edit
      case 'comment':       return permissions.can_comment
      case 'validate':      return permissions.can_validate
      case 'override_lock': return permissions.can_override_lock
      default:              return false
    }
  })()

  return hasPermission ? <>{children}</> : <>{fallback}</>
}
