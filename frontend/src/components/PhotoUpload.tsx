'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react'
import { deletePhoto as apiDeletePhoto } from '@/lib/api'

interface PhotoUploadProps {
  loaId: string | null
  onPhotosChange?: (photos: { index: number; url: string }[]) => void
}

interface Photo {
  index: number
  url: string        // server URL (for passing to parent / preview)
  name: string
  blobUrl: string    // local blob URL for display (avoids CORS issues)
  isServer: boolean
  file?: File        // kept for pending uploads (loaId not yet available)
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface PhotoUploadRef {
  uploadPending: (newLoaId: string) => Promise<void>
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('laura_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const PhotoUpload = forwardRef<PhotoUploadRef, PhotoUploadProps>(function PhotoUpload(
  { loaId, onPhotosChange },
  ref,
) {
  const [photos, setPhotos]       = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [loaded, setLoaded]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep a stable ref to onPhotosChange so the effect doesn't re-fire
  const onChangeRef = useRef(onPhotosChange)
  onChangeRef.current = onPhotosChange

  // Notify parent whenever photos change
  const notifyParent = useCallback((updated: Photo[]) => {
    onChangeRef.current?.(updated.map(p => ({ index: p.index, url: p.url })))
  }, [])

  // ── Cleanup blob URLs on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      photos.forEach(p => {
        if (p.blobUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(p.blobUrl)
        }
      })
    }
  }, []) // intentionally empty — runs only on unmount

  // ── Load existing photos from backend ─────────────────────────────────
  useEffect(() => {
    if (!loaId) {
      setLoaded(true)
      return
    }

    let cancelled = false

    async function loadExisting() {
      const found: Photo[] = []

      // Probe each slot with an <img> load — no fetch, no CORS preflight.
      await Promise.all([1, 2].map(idx => new Promise<void>(resolve => {
        const url = `${API_BASE}/loa/${loaId}/photos/${idx}?t=${Date.now()}`
        const img = new Image()
        img.onload = () => {
          found.push({
            index: idx,
            url,
            name: `Photo ${idx}`,
            blobUrl: url,   // direct server URL works in <img>
            isServer: true,
          })
          resolve()
        }
        img.onerror = () => resolve()   // 404 = slot empty, fine
        img.src = url
      })))

      if (cancelled) return

      found.sort((a, b) => a.index - b.index)
      setPhotos(found)
      setLoaded(true)
      notifyParent(found)
    }

    setLoaded(false)
    loadExisting()

    return () => { cancelled = true }
  }, [loaId, notifyParent])

  // ── Upload pending photos after LOA creation ──────────────────────────
  useImperativeHandle(ref, () => ({
    async uploadPending(newLoaId: string) {
      const pending = photos.filter(p => !p.isServer && p.file)
      if (pending.length === 0) return

      const headers = getAuthHeaders()

      for (const photo of pending) {
        try {
          const formData = new FormData()
          formData.append('file', photo.file!)
          const res = await fetch(`${API_BASE}/loa/${newLoaId}/photos`, {
            method: 'POST',
            headers,
            body: formData,
          })
          if (!res.ok) {
            console.warn(`[PhotoUpload] Upload photo ${photo.index} failed:`, res.status)
          }
        } catch (err) {
          console.warn(`[PhotoUpload] Upload photo ${photo.index} error:`, err)
        }
      }
    },
  }), [photos])

  // ── File select handler ───────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Only JPG and PNG files allowed')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5 MB')
      return
    }

    if (photos.length >= 2) {
      setError('Maximum 2 photos per LOA')
      return
    }

    const blobUrl = URL.createObjectURL(file)
    const nextIndex = photos.length + 1

    if (!loaId) {
      // No LOA saved yet — keep file in memory, upload later via uploadPending
      const newPhoto: Photo = {
        index: nextIndex,
        url: blobUrl,
        name: file.name,
        blobUrl,
        isServer: false,
        file,
      }
      const updated = [...photos, newPhoto]
      setPhotos(updated)
      notifyParent(updated)
      return
    }

    // LOA exists — upload immediately
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const headers = getAuthHeaders()
      const res = await fetch(`${API_BASE}/loa/${loaId}/photos`, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
        setError(err.detail || 'Upload failed')
        URL.revokeObjectURL(blobUrl)
        return
      }

      const serverUrl = `${API_BASE}/loa/${loaId}/photos/${nextIndex}`
      const uploaded: Photo = {
        index: nextIndex,
        url: serverUrl,
        name: file.name,
        blobUrl,    // keep the local blob for immediate display (no second fetch)
        isServer: true,
      }
      const updated = [...photos, uploaded]
      setPhotos(updated)
      notifyParent(updated)
    } catch {
      setError('Upload failed — check backend is running')
      URL.revokeObjectURL(blobUrl)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // ── Remove handler ────────────────────────────────────────────────────
  async function removePhoto(index: number) {
    const photo = photos.find(p => p.index === index)
    if (!photo) return

    // Delete from backend if server-side
    if (photo.isServer && loaId) {
      try {
        await apiDeletePhoto(loaId, index)
      } catch {
        setError('Delete failed — try again')
        return
      }
    }

    // Revoke blob URL
    if (photo.blobUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(photo.blobUrl)
    }

    // Re-index remaining photos (1-based, sequential)
    const updated = photos
      .filter(p => p.index !== index)
      .map((p, i) => ({ ...p, index: i + 1 }))

    setPhotos(updated)
    notifyParent(updated)
    setError('')
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Photos
            <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-muted)' }}>
              {photos.length}/2 — required for CEO presentation
            </span>
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Previous edition photos · Reference photos · Creative renders/concepts
          </p>
        </div>
        {photos.length < 2 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !loaded}
            className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
          >
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--text-muted)', borderTopColor: 'var(--text-primary)' }} />
                Uploading…
              </span>
            ) : '+ Add photo'}
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png"
        className="hidden" onChange={handleFileSelect} />

      {error && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg"
          style={{ background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)' }}>
          {error}
        </p>
      )}

      {/* Loading state */}
      {!loaded && (
        <div className="flex items-center gap-2 py-4">
          <span className="w-4 h-4 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading photos…</span>
        </div>
      )}

      {/* Photo grid */}
      {loaded && (
        <div className="grid grid-cols-2 gap-3">
          {photos.map(photo => (
            <div key={photo.index} className="relative group rounded-xl overflow-hidden"
              style={{ aspectRatio: '16/9', border: '1px solid var(--border)' }}>
              <img
                src={photo.blobUrl}
                alt={`Photo ${photo.index}`}
                className="w-full h-full object-cover"
              />
              {/* Server badge */}
              {photo.isServer && (
                <div className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)' }}>
                  Saved
                </div>
              )}
              {/* Hover overlay with actions */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0
                              group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <p className="text-white text-xs px-2 text-center truncate w-full">{photo.name}</p>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { removePhoto(photo.index); setTimeout(() => inputRef.current?.click(), 100) }}
                    className="text-xs px-3 py-1 rounded-lg"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                    Replace
                  </button>
                  <button type="button" onClick={() => removePhoto(photo.index)}
                    className="text-xs px-3 py-1 rounded-lg"
                    style={{ background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)' }}>
                    Remove
                  </button>
                </div>
              </div>
              {/* Index badge */}
              <div className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                Photo {photo.index}
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: 2 - photos.length }).map((_, i) => (
            <button key={`empty-${i}`} type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
              style={{
                aspectRatio: '16/9',
                border: '1.5px dashed var(--border-strong)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-xs">Photo {photos.length + i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {loaded && photos.length === 0 && (
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          Slides without photos look incomplete in the CEO presentation. Add at least one photo.
        </p>
      )}
    </div>
  )
})

export default PhotoUpload
