// ============================================================
// LAURA — Review API client
// ============================================================

import axios from 'axios'
import type { ReviewVerdict, ReviewComment, ReviewModeConfig, TitleConfig, LOAPhotoRecord, LOAWithStages, LOAReviewStageRecord, AlignmentStage } from '@/types/review'
import type { LOA } from '@/types/loa'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('laura_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const client = axios.create({ baseURL: API_BASE })
client.interceptors.request.use(cfg => {
  Object.assign(cfg.headers, authHeaders())
  return cfg
})
client.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('laura_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Types returned by the API ────────────────────────────────────────────────

export interface DeckResponse {
  cycle: {
    id: string
    name: string
    cycleType: string
    status: 'draft' | 'open' | 'under_review' | 'closed'
    startDate: string
    endDate: string
    isActive: boolean
    /** Throwaway cycle used to exercise the flow before go-live. */
    isTest: boolean
    /** Closed cycles are archives — the review UI goes read-only. */
    isClosed: boolean
    closedAt: string | null
    closedBy: string | null
  }
  loas: Array<LOA & { photos?: LOAPhotoRecord[] }>
  titleConfig: TitleConfig | null
  titlePhoto: LOAPhotoRecord | null
  overviewPhotos: Record<string, LOAPhotoRecord[]>
}

export interface VerdictsResponse {
  verdicts: ReviewVerdict[]
  isSubmitted: boolean
  submittedAt: string | null
}

export interface SubmitResponse {
  id: string
  submittedAt: string
  summary: { approved: number; rejected: number; total: number }
  alreadySubmitted: boolean
}

// ── Deck + verdicts + comments ────────────────────────────────────────────────

export async function fetchDeck(cycleId: string): Promise<DeckResponse> {
  const { data } = await client.get(`/review/${cycleId}/deck`)
  return data
}

export async function fetchVerdicts(cycleId: string): Promise<VerdictsResponse> {
  const { data } = await client.get(`/review/${cycleId}/verdicts`)
  return data
}

export async function submitVerdict(
  cycleId: string,
  loaId: string,
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<ReviewVerdict> {
  const { data } = await client.post(`/review/${cycleId}/verdict`, {
    loa_id: loaId,
    decision,
    reason: reason || null,
  })
  return data
}

export async function fetchComments(cycleId: string, loaId?: string): Promise<ReviewComment[]> {
  const params = loaId ? `?loa_id=${loaId}` : ''
  const { data } = await client.get(`/review/${cycleId}/comments${params}`)
  return data
}

export async function postComment(
  cycleId: string,
  slideId: string,
  text: string,
  anchor?: string,
): Promise<ReviewComment> {
  const { data } = await client.post(`/review/${cycleId}/comment`, {
    slide_id: slideId,
    text,
    anchor: anchor ?? null,
  })
  return data
}

// ── Alignment review stage ────────────────────────────────────────────────────

export async function fetchAlignmentQueue(stage: AlignmentStage): Promise<{
  stage: AlignmentStage
  loas: LOAWithStages[]
  total: number
}> {
  const { data } = await client.get(`/review-stage/queue?stage=${stage}`)
  return data
}

export async function fetchLoaStages(loaId: string): Promise<{
  loaId: string
  stages: Record<AlignmentStage, LOAReviewStageRecord>
  currentStage: AlignmentStage | null
  allApproved: boolean
}> {
  const { data } = await client.get(`/review-stage/${loaId}/stages`)
  return data
}

export async function approveStage(loaId: string, stage: AlignmentStage): Promise<{
  stage: LOAReviewStageRecord
  loaStatus: string
  allApproved: boolean
}> {
  const { data } = await client.post(`/review-stage/${loaId}/approve`, { stage })
  return data
}

export async function submitReview(cycleId: string): Promise<SubmitResponse> {
  const { data } = await client.post(`/review/${cycleId}/submit`)
  return data
}

// ── Review modes (admin) ──────────────────────────────────────────────────────

export async function fetchReviewModes(): Promise<ReviewModeConfig[]> {
  const { data } = await client.get('/admin/review-modes')
  return data.map((m: any) => ({
    id: m.id,
    roleName: m.roleName,
    mode: m.mode,
    updatedAt: m.updatedAt,
    updatedBy: m.updatedBy,
  }))
}

export async function updateReviewMode(
  roleName: string,
  mode: 'slideshow' | 'board' | 'list',
): Promise<ReviewModeConfig> {
  const { data } = await client.put('/admin/review-modes', { role_name: roleName, mode })
  return {
    id: data.id,
    roleName: data.roleName,
    mode: data.mode,
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy,
  }
}

// ── Photo upload / delete ─────────────────────────────────────────────────────

export async function uploadLOAPhoto(
  cycleId: string,
  loaId: string,
  photoType: 'execution_1' | 'execution_2',
  file: File,
): Promise<LOAPhotoRecord> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post(
    `/review/${cycleId}/loa/${loaId}/photos?photo_type=${photoType}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export async function deletePhoto(cycleId: string, photoId: string): Promise<void> {
  await client.delete(`/review/${cycleId}/photos/${photoId}`)
}

export async function uploadTitlePhoto(
  cycleId: string,
  file: File,
): Promise<LOAPhotoRecord> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post(
    `/review/${cycleId}/title-photo`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export async function uploadOverviewPhoto(
  cycleId: string,
  categorySlug: string,
  photoType: string,
  file: File,
): Promise<LOAPhotoRecord> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post(
    `/review/${cycleId}/overview-photo/${encodeURIComponent(categorySlug)}?photo_type=${photoType}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export async function uploadLensPhoto(
  cycleId: string,
  category: string,
  columnId: string,
  file: File,
): Promise<LOAPhotoRecord> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post(
    `/review/${cycleId}/lens-photo/${encodeURIComponent(category)}/${encodeURIComponent(columnId)}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export async function patchPhotoCrop(
  cycleId: string,
  photoId: string,
  crop: { focalX: number; focalY: number; zoom: number },
): Promise<void> {
  await client.patch(`/review/${cycleId}/photos/${photoId}/crop`, {
    focal_x: crop.focalX,
    focal_y: crop.focalY,
    zoom: crop.zoom,
  })
}

// ── Title config ──────────────────────────────────────────────────────────────

export async function saveTitleConfig(
  cycleId: string,
  config: Partial<TitleConfig>,
): Promise<TitleConfig> {
  const body = {
    title: config.title ?? null,
    subtitle: config.subtitle ?? null,
    year: config.year ?? null,
    title_font_size: config.titleFontSize ?? 'medium',
    title_color: config.titleColor ?? '#FFFFFF',
    subtitle_font_size: config.subtitleFontSize ?? 'medium',
    subtitle_color: config.subtitleColor ?? '#FFFFFF',
    divider_style: config.dividerStyle ?? 'black',
    overview_layouts: config.overviewLayouts ?? {},
    lens_configs: config.lensConfigs ?? {},
    loa_photo_modes: config.loaPhotoModes ?? {},
  }
  const { data } = await client.put(`/review/${cycleId}/title-config`, body)
  return data
}
