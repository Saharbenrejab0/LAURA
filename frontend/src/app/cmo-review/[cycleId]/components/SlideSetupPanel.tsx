'use client'
/**
 * SlideSetupPanel — the 300px inspector on the right of the stage.
 *
 * Contextual to the current slide: text/size/colour for the title, background
 * for dividers, layout for overviews, photo rules for LOA slides. Only deck
 * preparers see it — reviewers get the slides clean, with no chrome.
 */
import { useEffect, useState } from 'react'
import type {
  Slide, TitleConfig, TitleSlideData, SectionDividerData,
  CategoryOverviewData, LOADetailData, FontSize, DividerStyle, OverviewLayout,
} from '@/types/review'
import type { LOASlideSizing, SlideScale } from '@/types/review'
import { DIVIDER_STYLES, TITLE_COLORS, SLIDE_SCALES } from '@/types/review'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const GOLD_TEXT = '#8A6A3F'

interface Props {
  slide: Slide
  slideNumber: number
  titleConfig: TitleConfig | null
  onConfigChange: (patch: Partial<TitleConfig>) => void
  /** LOA slide sizing — per session, not stored with the deck. */
  sizing: LOASlideSizing
  onSizingChange: (patch: Partial<LOASlideSizing>) => void
}

export default function SlideSetupPanel({
  slide, slideNumber, titleConfig, onConfigChange, sizing, onSizingChange,
}: Props) {
  const subtitle =
    slide.type === 'title_slide' ? `Slide ${slideNumber} · title template`
    : slide.type === 'section_divider' ? `Slide ${slideNumber} · section divider`
    : slide.type === 'category_overview' ? `Slide ${slideNumber} · section overview`
    : `Slide ${slideNumber} · LOA detail template`

  return (
    <div style={{
      width: 300, flexShrink: 0, background: '#fff',
      borderLeft: '1px solid #EAEAEA',
      display: 'flex', flexDirection: 'column',
      boxShadow: '-18px 0 40px rgba(10,10,10,.05)',
      fontFamily: FONT,
    }}>
      <div style={{
        padding: '16px 18px 12px', borderBottom: '1px solid #F0EFEC',
        display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0A0A' }}>Slide setup</span>
        <span style={{ fontSize: 11, color: '#9B9690' }}>{subtitle}</span>
      </div>

      <div style={{
        flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column',
        gap: 20, overflowY: 'auto',
      }}>
        {slide.type === 'title_slide' && (
          <TitleSetup
            data={slide.data as TitleSlideData}
            config={titleConfig}
            onChange={onConfigChange}
          />
        )}
        {slide.type === 'section_divider' && (
          <DividerSetup
            data={slide.data as SectionDividerData}
            onChange={onConfigChange}
          />
        )}
        {slide.type === 'category_overview' && (
          <OverviewSetup
            data={slide.data as CategoryOverviewData}
            config={titleConfig}
            onChange={onConfigChange}
          />
        )}
        {slide.type === 'loa_detail' && (
          <LOASetup
            data={slide.data as LOADetailData}
            sizing={sizing}
            onSizingChange={onSizingChange}
            titleConfig={titleConfig}
            onConfigChange={onConfigChange}
          />
        )}
      </div>
    </div>
  )
}

// ── Title ────────────────────────────────────────────────────────────────────

function TitleSetup({ data, config, onChange }: {
  data: TitleSlideData
  config: TitleConfig | null
  onChange: (patch: Partial<TitleConfig>) => void
}) {
  const size: FontSize = config?.titleFontSize || 'medium'
  const color = config?.titleColor || '#FFFFFF'

  return (
    <>
      <Group label="Text">
        <TextField
          label="Title"
          value={config?.title ?? data.cycleName ?? ''}
          onCommit={v => onChange({ title: v })}
        />
        <TextField
          label="Subtitle"
          value={config?.subtitle ?? ''}
          placeholder="Validation session · date"
          onCommit={v => onChange({ subtitle: v })}
        />
        <TextField
          label="Year"
          value={config?.year ?? data.cycleYear ?? ''}
          onCommit={v => onChange({ year: v })}
        />
      </Group>

      <Group label="Size">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['small', 'medium', 'large'] as const).map(k => {
            const on = size === k
            return (
              <button
                key={k}
                onClick={() => onChange({ titleFontSize: k, subtitleFontSize: k })}
                style={{
                  flex: 1, textAlign: 'center', fontSize: 12, fontFamily: FONT,
                  fontWeight: on ? 600 : 500,
                  color: on ? '#fff' : '#5A554F',
                  background: on ? '#0A0A0A' : '#fff',
                  border: `1px solid ${on ? '#0A0A0A' : '#E0DED9'}`,
                  borderRadius: 8, padding: '8px 0', cursor: 'pointer',
                }}
              >
                {k === 'small' ? 'Small' : k === 'medium' ? 'Medium' : 'Large'}
              </button>
            )
          })}
        </div>
      </Group>

      <Group label="Text colour">
        <div style={{ display: 'flex', gap: 8 }}>
          {TITLE_COLORS.map(c => (
            <button
              key={c}
              onClick={() => onChange({ titleColor: c, subtitleColor: c })}
              title={c}
              aria-label={`Text colour ${c}`}
              style={{
                width: 34, height: 34, borderRadius: 8, background: c,
                border: c === '#FFFFFF' ? '1px solid #E0DED9' : '1px solid transparent',
                boxShadow: color === c ? '0 0 0 2px #fff, 0 0 0 4px #0A0A0A' : 'none',
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            />
          ))}
        </div>
      </Group>

      <Note>
        Drop a photo anywhere on the slide to set the cover, or click it to browse.
        The scrim keeps the text legible on any image.
      </Note>
    </>
  )
}

// ── Divider ──────────────────────────────────────────────────────────────────

function DividerSetup({ data, onChange }: {
  data: SectionDividerData
  onChange: (patch: Partial<TitleConfig>) => void
}) {
  return (
    <>
      <Group label="Background">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(Object.keys(DIVIDER_STYLES) as DividerStyle[]).map(k => {
            const p = DIVIDER_STYLES[k]
            const on = data.style === k
            return (
              <button
                key={k}
                onClick={() => onChange({ dividerStyle: k })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  border: on ? '1.5px solid #0A0A0A' : '1px solid #E0DED9',
                  background: on ? '#FAFAFA' : '#fff',
                  borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                  fontFamily: FONT, textAlign: 'left',
                }}
              >
                <span style={{
                  width: 34, height: 22, borderRadius: 4,
                  background: p.swatch, border: '1px solid #D9D2C8', flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, fontWeight: on ? 600 : 400, color: '#2A2A2A' }}>
                  {p.label}
                </span>
              </button>
            )
          })}
        </div>
      </Group>

      <Group label="Label">
        <ReadonlyField label="Section name" value={data.label.toUpperCase()} />
        <span style={{ fontSize: 11, color: '#9B9690', lineHeight: 1.55 }}>
          Generated automatically — category dividers use the category name,
          family dividers the activity name.
        </span>
      </Group>
    </>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────

const LAYOUTS: Array<{ key: OverviewLayout; label: string; desc: string }> = [
  { key: 'priorities', label: 'Key investment priorities', desc: 'Total + brand tiles + 4 context photos' },
  { key: 'family', label: 'Family split', desc: 'Activity-family donut + brand tiles' },
  { key: 'lens_overview', label: 'Lens overview', desc: 'Programme columns with bullets' },
  { key: 'lens_investment', label: 'Lens investment', desc: 'Investment columns with captions' },
]

function OverviewSetup({ data, config, onChange }: {
  data: CategoryOverviewData
  config: TitleConfig | null
  onChange: (patch: Partial<TitleConfig>) => void
}) {
  const setLayout = (layout: OverviewLayout) => {
    onChange({
      overviewLayouts: { ...(config?.overviewLayouts || {}), [data.category]: layout },
    })
  }

  const isLens = data.layout === 'lens_overview' || data.layout === 'lens_investment'
  // Lenses slides are always two fixed consecutive slides — the layout radio is hidden;
  // a read-only label tells the preparer which of the two slides they're editing.
  const lensLabel = data.layout === 'lens_overview' ? 'Slide A — Lens overview' : 'Slide B — Lens investment'

  return (
    <>
      {isLens ? (
        <Group label="Layout">
          <div style={{
            border: '1px solid #E0DED9', borderRadius: 8, padding: '9px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: '#0A0A0A', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0A0A0A' }}>{lensLabel}</span>
          </div>
          <span style={{ fontSize: 10.5, color: '#9B9690', lineHeight: 1.55 }}>
            Both lens slides are always present in the deck. Edit each slide's title directly on the slide.
          </span>
        </Group>
      ) : (
      <Group label="Layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LAYOUTS.filter(l => !l.key.startsWith('lens_')).map(l => {
            const on = data.layout === l.key
            return (
              <button
                key={l.key}
                onClick={() => setLayout(l.key)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%',
                  border: on ? '1.5px solid #0A0A0A' : '1px solid #E0DED9',
                  background: on ? '#FAFAFA' : '#fff',
                  borderRadius: 8, padding: '9px 10px', cursor: 'pointer',
                  fontFamily: FONT, textAlign: 'left',
                }}
              >
                <span style={{
                  width: 9, height: 9, borderRadius: 99, flexShrink: 0, marginTop: 3,
                  background: on ? '#0A0A0A' : 'transparent',
                  border: on ? 'none' : '1px solid #C6C1B8',
                }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: on ? 600 : 400, color: on ? '#0A0A0A' : '#5A554F' }}>
                    {l.label}
                  </span>
                  <span style={{ fontSize: 10, color: '#9B9690' }}>{l.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Group>
      )}

      {/* Photos note — conditional per layout */}
      {data.layout === 'priorities' && (
        <Group label="Photos · 4 max">
          <span style={{ fontSize: 11, color: '#5A554F', lineHeight: 1.6 }}>
            Four context photos sit under the tile grid. Drop images onto the
            CONTEXT frames — hover a filled frame for Replace and Remove.
            Pan and zoom by dragging or scrolling the filled frame.
          </span>
        </Group>
      )}

      {isLens && (
        <Group label="Photos">
          <span style={{ fontSize: 11, color: '#5A554F', lineHeight: 1.6 }}>
            Each column has its own photo frame. Click or drag an image onto the
            frame to upload. Hover a filled frame to pan, zoom, replace or remove.
            Add columns with the + button on the slide.
          </span>
        </Group>
      )}

      {/* family layout: no photos section */}

      <Note>
        {isLens
          ? 'Edit column headers, subtitles and bullets directly on the slide. Config is saved automatically.'
          : 'Amounts are read from the cycle, never typed: tiles aggregate approved + pending LOAs per priority and per activity family.'}
      </Note>
    </>
  )
}

// ── LOA detail ───────────────────────────────────────────────────────────────

const PHOTO_MODES = [
  { n: 2, label: 'Two photos', note: 'Portrait, side by side', icon: '▮▮' },
  { n: 1, label: 'One photo', note: 'Landscape 16:9', icon: '▬' },
  { n: 0, label: 'No photos', note: 'Upload zones shown', icon: '⬚' },
]

const SCALE_LABELS: Record<SlideScale, string> = {
  compact: 'Compact',
  standard: 'Standard',
  roomy: 'Roomy',
}

const TEXT_NOTES: Record<SlideScale, string> = {
  compact: 'Smallest type, three lines per section',
  standard: 'Readable at a glance, two lines per section',
  roomy: 'Largest type, two lines per section',
}

const PHOTO_NOTES: Record<SlideScale, string> = {
  compact: 'Narrow frames, widest text card',
  standard: 'Balanced frames and text',
  roomy: 'Largest frames, text card stays fixed',
}

function LOASetup({ data, sizing, onSizingChange, titleConfig, onConfigChange }: {
  data: LOADetailData
  sizing: LOASlideSizing
  onSizingChange: (patch: Partial<LOASlideSizing>) => void
  titleConfig: TitleConfig | null
  onConfigChange: (patch: Partial<TitleConfig>) => void
}) {
  const loa = data.loa
  const photos = loa.photos || []
  const uploadedCount = photos.filter(p => p.photoType.startsWith('execution_')).length
  const savedMode = titleConfig?.loaPhotoModes?.[loa.id]
  const selected = savedMode !== undefined ? savedMode : uploadedCount

  const setMode = (n: number) => {
    if (n < uploadedCount) {
      const willHide = uploadedCount - n
      const ok = window.confirm(
        `Switching to ${n === 0 ? 'no photos' : n === 1 ? '1 photo' : '2 photos'} will hide ${willHide} uploaded photo${willHide > 1 ? 's' : ''} (they are not deleted — switch back to restore). Continue?`
      )
      if (!ok) return
    }
    onConfigChange({
      loaPhotoModes: { ...(titleConfig?.loaPhotoModes ?? {}), [loa.id]: n },
    })
  }

  return (
    <>
      <Group label="Photo size">
        <ScalePicker
          value={sizing.photos}
          notes={PHOTO_NOTES}
          onChange={v => onSizingChange({ photos: v })}
        />
      </Group>

      <Group label="Text size">
        <ScalePicker
          value={sizing.text}
          notes={TEXT_NOTES}
          onChange={v => onSizingChange({ text: v })}
        />
        <span style={{ fontSize: 10.5, color: '#9B9690', lineHeight: 1.55 }}>
          The description / tools / KPI card keeps the same fixed shape at every
          size — long paragraphs are trimmed with an ellipsis rather than
          overflowing the slide. Hover a line to read it in full.
        </span>
      </Group>

      <Group label="Photos · 2 max">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PHOTO_MODES.map(m => {
            const on = m.n === selected
            return (
              <button
                key={m.n}
                onClick={() => setMode(m.n)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  border: on ? '1.5px solid #0A0A0A' : '1px solid #E0DED9',
                  background: on ? '#FAFAFA' : '#fff',
                  borderRadius: 8, padding: '9px 10px',
                  cursor: 'pointer', fontFamily: FONT, width: '100%', textAlign: 'left',
                }}
              >
                <span style={{
                  display: 'flex', gap: 3, width: 34, justifyContent: 'center',
                  fontSize: 12, color: on ? '#0A0A0A' : '#9B9690',
                }}>
                  {m.icon}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: on ? 600 : 400, color: '#2A2A2A' }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: 10, color: '#9B9690' }}>{m.note}</span>
                </span>
              </button>
            )
          })}
        </div>
        <span style={{ fontSize: 10.5, color: '#9B9690', lineHeight: 1.55 }}>
          Choose a layout, then upload into each frame on the slide.
        </span>
      </Group>

      <div style={{
        background: '#FAFAFA', border: '1px solid #F0EFEC', borderRadius: 10,
        padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 7,
      }}>
        <span style={groupLabelStyle}>Rules</span>
        <span style={{ fontSize: 11, lineHeight: 1.6, color: '#5A554F' }}>
          Two photos → both portrait, side by side. One photo → landscape 16:9.
          Zero → dashed upload zones, and the slide still generates.
        </span>
      </div>

      <Group label="Uploaded by">
        <span style={{ fontSize: 11, lineHeight: 1.6, color: '#5A554F' }}>
          Local marketer, EMEA creator or admin — before the deck is compiled.
          Reviewers see them read-only.
        </span>
      </Group>
    </>
  )
}

// ── Primitives ───────────────────────────────────────────────────────────────

const groupLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.11em',
  textTransform: 'uppercase', color: GOLD_TEXT,
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0 }}>
      <span style={groupLabelStyle}>{label}</span>
      {children}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#FAFAFA', border: '1px solid #F0EFEC', borderRadius: 10,
      padding: '11px 12px', fontSize: 11, lineHeight: 1.6, color: '#5A554F', flexShrink: 0,
    }}>
      {children}
    </div>
  )
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: '1px solid #E0DED9', borderRadius: 8, padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <span style={{ fontSize: 9, color: '#9B9690' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#2A2A2A' }}>{value}</span>
    </div>
  )
}

/** Editable text field — commits on blur or Enter, reverts on Escape. */
function TextField({ label, value, placeholder, onCommit }: {
  label: string
  value: string
  placeholder?: string
  onCommit: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)

  // Track upstream changes while the user isn't editing this field.
  useEffect(() => { if (!focused) setDraft(value) }, [value, focused])

  const commit = () => {
    setFocused(false)
    if (draft !== value) onCommit(draft)
  }

  return (
    <div style={{
      border: `1px solid ${focused ? '#0A0A0A' : '#E0DED9'}`,
      borderRadius: 8, padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 2,
      transition: 'border-color 120ms',
    }}>
      <span style={{ fontSize: 9, color: '#9B9690' }}>{label}</span>
      <input
        value={draft}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.currentTarget.blur() }
          else if (e.key === 'Escape') { setDraft(value); setFocused(false); e.currentTarget.blur() }
        }}
        style={{
          fontSize: 12, color: '#2A2A2A', fontFamily: FONT,
          border: 'none', outline: 'none', background: 'transparent',
          padding: 0, width: '100%',
        }}
      />
    </div>
  )
}

/** Three-way segmented control used by the LOA slide's size settings. */
function ScalePicker({ value, notes, onChange }: {
  value: SlideScale
  notes: Record<SlideScale, string>
  onChange: (v: SlideScale) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        display: 'flex', gap: 1, background: '#EFEDE8',
        border: '1px solid #E0DED9', borderRadius: 8, padding: 2,
      }}>
        {SLIDE_SCALES.map(s => {
          const on = s === value
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              style={{
                flex: 1, border: 'none', borderRadius: 6,
                background: on ? '#fff' : 'transparent',
                boxShadow: on ? '0 1px 3px rgba(10,10,10,.12)' : 'none',
                color: on ? '#0A0A0A' : '#8E887E',
                fontSize: 11.5, fontWeight: on ? 600 : 500,
                padding: '7px 0', cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {SCALE_LABELS[s]}
            </button>
          )
        })}
      </div>
      <span style={{ fontSize: 10.5, color: '#9B9690' }}>{notes[value]}</span>
    </div>
  )
}
