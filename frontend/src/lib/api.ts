// ============================================================
// LAURA — API client
// All calls to the FastAPI backend go through here
// ============================================================

import axios from 'axios'
import type { LOA, LOAFormValues, AISuggestion } from '@/types/loa'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('laura_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('laura_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ---- Auth ----
export const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password })
  localStorage.setItem('laura_token', data.token)
  return data
}

export const logout = () => {
  localStorage.removeItem('laura_token')
  window.location.href = '/login'
}

// ---- LOAs ----
export const getLOAs = async (filters?: {
  status?: string
  cluster?: string
  activity_type?: string
}): Promise<LOA[]> => {
  const { data } = await api.get('/loa', { params: filters })
  return data
}

export const getLOA = async (id: string): Promise<LOA> => {
  const { data } = await api.get(`/loa/${id}`)
  return data
}

export const createLOA = async (values: Partial<LOAFormValues>): Promise<LOA> => {
  const { data } = await api.post('/loa', values)
  return data
}

export const updateLOA = async (id: string, values: Partial<LOAFormValues>): Promise<LOA> => {
  const { data } = await api.patch(`/loa/${id}`, values)
  return data
}

export const submitLOA = async (id: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/submit`)
  return data
}

export const approveLOA = async (id: string, comment?: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/approve`, { comment })
  return data
}

export const rejectLOA = async (id: string, reason: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/reject`, { reason })
  return data
}

// ---- AI suggestions ----
export const getAISuggestion = async (params: {
  activity_type: string
  cluster: string
  category: string
  brand: string
  fy_total: number
  num_doors: number
}): Promise<AISuggestion> => {
  const { data } = await api.post('/loa/suggest', params)
  return data
}

// ---- File download ----
export const downloadExcel = async (id: string) => {
  const response = await api.get(`/loa/${id}/excel`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `LOA_${id}.xlsx`)
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const downloadPPT = async (id: string) => {
  const response = await api.get(`/loa/${id}/ppt`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `LOA_${id}.pptx`)
  document.body.appendChild(link)
  link.click()
  link.remove()
}
