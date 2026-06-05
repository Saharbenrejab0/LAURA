'use client'

import { useState, useRef } from 'react'

interface PhotoUploadProps {
  loaId: string | null       // null when LOA not yet saved
  onPhotosChange?: (photos: { index: number; url: string }[]) => void
}

interface Photo {
  index: number
  url: string
  name: string
  preview: string
}

export default function PhotoUpload({ loaId, onPhotosChange }: PhotoUploadProps) {
  const [photos, setPhotos]     = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    // Validate type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Only JPG and PNG files allowed')
      return
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB')
      return
    }

    // Max 2 photos
    if (photos.length >= 2) {
      setError('Maximum 2 photos allowed')
      return
    }

    // If LOA not saved yet, store locally for preview only
    const preview = URL.createObjectURL(file)
    const newPhoto: Photo = {
      index: photos.length + 1,
      url: preview,
      name: file.name,
      preview,
    }

    if (!loaId) {
      // Preview only — will upload when LOA is saved
      const updated = [...photos, newPhoto]
      setPhotos(updated)
      onPhotosChange?.(updated.map(p => ({ index: p.index, url: p.url })))
      return
    }

    // Upload to backend
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('laura_token')
      const res = await fetch(`http://localhost:8000/loa/${loaId}/photos`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.detail || 'Upload failed')
        return
      }
      const data = await res.json()
      const uploaded: Photo = {
        index: photos.length + 1,
        url: `http://localhost:8000/loa/${loaId}/photos/${photos.length + 1}`,
        name: file.name,
        preview,
      }
      const updated = [...photos, uploaded]
      setPhotos(updated)
      onPhotosChange?.(updated.map(p => ({ index: p.index, url: p.url })))
    } catch {
      setError('Upload failed — check backend is running')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removePhoto(index: number) {
    const updated = photos.filter(p => p.index !== index)
      .map((p, i) => ({ ...p, index: i + 1 }))
    setPhotos(updated)
    onPhotosChange?.(updated.map(p => ({ index: p.index, url: p.url })))
    setError('')
  }

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
            disabled={uploading}
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

      {/* Photo grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Uploaded photos */}
        {photos.map(photo => (
          <div key={photo.index} className="relative group rounded-xl overflow-hidden"
            style={{ aspectRatio: '16/9', border: '1px solid var(--border)' }}>
            <img src={photo.preview} alt={`Photo ${photo.index}`}
              className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0
                            group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.5)' }}>
              <p className="text-white text-xs mb-2 px-2 text-center truncate w-full">{photo.name}</p>
              <button type="button" onClick={() => removePhoto(photo.index)}
                className="text-xs px-3 py-1 rounded-lg"
                style={{ background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)' }}>
                Remove
              </button>
            </div>
            <div className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
              Photo {photo.index}
            </div>
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: 2 - photos.length }).map((_, i) => (
          <button key={i} type="button"
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

      {photos.length === 0 && (
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          💡 Slides without photos look incomplete in the CEO presentation. Add at least one photo.
        </p>
      )}
    </div>
  )
}
