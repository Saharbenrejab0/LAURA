'use client'
/**
 * PhotoUploader — live drop target used by every photo frame in the deck.
 *
 * States:
 *   empty    — 1.5px dashed #ADA69B on #F7F4ED, camera glyph
 *   filled   — photo with hover overlay showing Replace + Remove icons
 *   busy     — spinner while upload is in-flight
 *
 * Crop / pan / zoom (when filled and canEdit):
 *   • Drag the image to pan (grab cursor)
 *   • Scroll or +/− buttons to zoom
 *   • Crop state (focalX, focalY, zoom) is persisted per photo via onCropChange
 *
 * Reviewers (canEdit=false) see the photo clean, no chrome.
 */
import { useState, useRef, useCallback, useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"

export interface CropState {
  focalX: number   // 0.0–1.0, default 0.5
  focalY: number   // 0.0–1.0, default 0.5
  zoom:   number   // 1.0 = fit, >1.0 = zoomed in, default 1.0
}

const DEFAULT_CROP: CropState = { focalX: 0.5, focalY: 0.5, zoom: 1.0 }

export function photoSrc(url: string): string {
  return url.startsWith('/') ? `${API_BASE}${url}` : url
}

interface Props {
  existingUrl?: string
  existingId?: string
  canEdit: boolean
  label?: string
  cornerLabel?: string
  border?: string
  aspectRatio?: string
  /** Current crop state from the server (or undefined for defaults). */
  cropState?: CropState
  onUpload: (file: File) => Promise<void> | void
  onRemove: () => void
  /** Called (debounced on mouseup / scroll-end) when the user adjusts crop. */
  onCropChange?: (crop: CropState) => void
}

export default function PhotoUploader({
  existingUrl, existingId, canEdit,
  label = 'Photo', cornerLabel, border = '1px solid #000', aspectRatio,
  cropState, onUpload, onRemove, onCropChange,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Local crop state — initialized from prop, kept in sync on prop changes only
  // when not currently dragging (prevents server round-trip resetting the UI).
  const [crop, setCrop] = useState<CropState>(cropState ?? DEFAULT_CROP)
  const cropRef = useRef(crop)
  cropRef.current = crop

  useEffect(() => {
    setCrop(cropState ?? DEFAULT_CROP)
  }, [existingId]) // reset crop when a new photo is loaded

  // Drag-to-pan state
  const dragRef = useRef<{ startX: number; startY: number; startFocalX: number; startFocalY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFiles = useCallback(async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setBusy(true)
    try {
      await onUpload(file)
    } catch {
      // Upload failed — clear the spinner so the frame isn't stuck
      setBusy(false)
    }
  }, [onUpload])

  // Also clear busy when a new photo URL arrives (upload succeeded via parent state update)
  useEffect(() => { setBusy(false) }, [existingUrl, existingId])

  // ── Drag-to-pan handlers ──────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canEdit || crop.zoom <= 1.0) return
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFocalX: cropRef.current.focalX,
      startFocalY: cropRef.current.focalY,
    }
    setDragging(true)
  }, [canEdit, crop.zoom])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const z = cropRef.current.zoom
      // sensitivity: 1px drag = 1/(containerSize*(zoom-1)) change in focal point
      const dx = (e.clientX - dragRef.current.startX) / (rect.width * (z - 1 + 0.001))
      const dy = (e.clientY - dragRef.current.startY) / (rect.height * (z - 1 + 0.001))
      const next: CropState = {
        focalX: Math.max(0, Math.min(1, dragRef.current.startFocalX - dx)),
        focalY: Math.max(0, Math.min(1, dragRef.current.startFocalY - dy)),
        zoom: cropRef.current.zoom,
      }
      setCrop(next)
    }
    const onUp = () => {
      setDragging(false)
      onCropChange?.(cropRef.current)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, onCropChange])

  // ── Scroll-to-zoom ────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!canEdit) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    const next: CropState = {
      ...cropRef.current,
      zoom: Math.max(1.0, Math.min(4.0, cropRef.current.zoom + delta)),
    }
    setCrop(next)
    onCropChange?.(next)
  }, [canEdit, onCropChange])

  const adjustZoom = useCallback((delta: number) => {
    const next: CropState = {
      ...cropRef.current,
      zoom: Math.max(1.0, Math.min(4.0, cropRef.current.zoom + delta)),
    }
    setCrop(next)
    onCropChange?.(next)
  }, [onCropChange])

  const frame: React.CSSProperties = {
    position: 'relative',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    border,
    // `flex: 1` alone only sizes this box when the parent is a flex container.
    // Under a plain block parent it is ignored, and because every child of the
    // FILLED state is absolutely positioned (the img, the hover overlay, the
    // zoom controls) the box then has no in-flow content and collapses to the
    // 2px of its own border. The photo becomes invisible and — worse — the
    // frame stops being a hit target, so click-to-upload, drag/drop, Replace
    // and Remove all die on that frame once it holds a photo. The lens slides
    // give this component exactly such a block parent.
    //
    // `height: '100%'` covers that case. It is inert everywhere else: a flex
    // item declares `flex-basis: 0%`, which wins over `height` for the flex
    // base size, so the call sites that already wrap this in a flex column are
    // byte-identical; and under a parent with an indefinite height it resolves
    // to `auto`, i.e. today's behaviour.
    ...(aspectRatio ? { aspectRatio } : { flex: 1, height: '100%' }),
  }

  // ── Filled ────────────────────────────────────────────────────────────────
  if (existingUrl) {
    // Image positioned so the focal point is at the container center.
    // left = (1 - zoom) * focalX * 100%  →  right-crops as zoom ↑
    // top  = (1 - zoom) * focalY * 100%
    const imgStyle: React.CSSProperties = {
      position: 'absolute',
      width: `${crop.zoom * 100}%`,
      height: `${crop.zoom * 100}%`,
      left: `${(1 - crop.zoom) * crop.focalX * 100}%`,
      top:  `${(1 - crop.zoom) * crop.focalY * 100}%`,
      objectFit: 'cover',
      display: 'block',
      userSelect: 'none',
      cursor: canEdit && crop.zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
      pointerEvents: 'none',
    }

    return (
      <div
        ref={containerRef}
        style={{ ...frame, cursor: canEdit ? (crop.zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default') : 'default' }}
        onMouseEnter={() => canEdit && setHovered(true)}
        onMouseLeave={() => canEdit && setHovered(false)}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onDragOver={e => { if (canEdit) { e.preventDefault(); setDragging(true) } }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          if (!canEdit) return
          e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files)
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSrc(existingUrl)} alt={label} style={imgStyle} draggable={false} />

        {cornerLabel && (
          <span style={{
            position: 'absolute', left: 0, top: 0,
            background: '#0A0A0A', color: '#fff',
            fontSize: 8, fontWeight: 700, letterSpacing: '.08em',
            padding: '3px 7px', pointerEvents: 'none', fontFamily: FONT, zIndex: 2,
          }}>
            {cornerLabel}
          </span>
        )}

        {/* Hover overlay: Replace + Remove icon buttons */}
        {canEdit && hovered && !dragging && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 3,
            background: 'rgba(10,10,10,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <button
              onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
              title="Replace photo"
              aria-label="Replace photo"
              style={overlayIconBtn('#fff', '#0A0A0A')}
            >
              <SwapIcon />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onRemove() }}
              title="Remove photo"
              aria-label="Remove photo"
              style={overlayIconBtn('transparent', '#fff', '1px solid rgba(255,255,255,.55)')}
            >
              <TrashIcon />
            </button>
          </div>
        )}

        {/* Zoom controls (bottom-right, visible on hover) */}
        {canEdit && hovered && !dragging && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6, zIndex: 4,
            display: 'flex', gap: 3,
          }}>
            <button
              onClick={e => { e.stopPropagation(); adjustZoom(-0.25) }}
              title="Zoom out"
              aria-label="Zoom out"
              style={zoomBtn}
            >
              −
            </button>
            <button
              onClick={e => { e.stopPropagation(); adjustZoom(0.25) }}
              title="Zoom in"
              aria-label="Zoom in"
              style={zoomBtn}
            >
              +
            </button>
          </div>
        )}

        {busy && <Spinner />}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>
    )
  }

  // ── Empty, read-only ──────────────────────────────────────────────────────
  if (!canEdit) {
    return (
      <div style={{
        ...frame,
        border: '1px solid #DDD9D2',
        background: '#F0EDE5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '.07em',
          color: '#B5AFA7', textTransform: 'uppercase', fontFamily: FONT,
        }}>
          {label}
        </span>
      </div>
    )
  }

  // ── Empty, editable ───────────────────────────────────────────────────────
  return (
    <div
      onClick={() => !busy && fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      style={{
        ...frame,
        border: `1.5px dashed ${dragging ? '#C9A678' : '#ADA69B'}`,
        background: dragging ? '#F3EAD3' : '#F7F4ED',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 7,
        cursor: 'pointer',
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      {busy ? <Spinner inline /> : (
        <>
          <span style={{
            width: 26, height: 22,
            border: '1.5px solid #8E887E', borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, border: '1.5px solid #8E887E' }} />
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600, color: '#6E685F',
            textAlign: 'center', lineHeight: 1.4, fontFamily: FONT,
          }}>
            Upload photo
            <br />
            <span style={{ fontWeight: 400, color: '#9B9690' }}>or drag &amp; drop</span>
          </span>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}

// ── Icon SVGs ─────────────────────────────────────────────────────────────────

function SwapIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false">
      <path d="M2 5h10M10 3l2 2-2 2M14 11H4M6 9l-2 2 2 2"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false">
      <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

function overlayIconBtn(bg: string, fg: string, bd = 'none'): React.CSSProperties {
  return {
    width: 32, height: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: bg, color: fg, border: bd,
    borderRadius: 8, cursor: 'pointer', flexShrink: 0,
  }
}

const zoomBtn: React.CSSProperties = {
  width: 22, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(10,10,10,.65)', color: '#fff',
  border: '1px solid rgba(255,255,255,.3)',
  borderRadius: 5, cursor: 'pointer', fontSize: 14, fontWeight: 700,
  fontFamily: FONT, lineHeight: 1,
}

function Spinner({ inline = false }: { inline?: boolean }) {
  const dot = (
    <span style={{
      width: 18, height: 18, borderRadius: 99,
      border: '2px solid #C9A678', borderTopColor: 'transparent',
      animation: 'spin 0.7s linear infinite', display: 'block',
    }} />
  )
  if (inline) return dot
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(253,251,247,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {dot}
    </div>
  )
}
