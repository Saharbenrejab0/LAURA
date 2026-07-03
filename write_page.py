import pathlib

content = r"""'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getLOA, validateWorkflowStep, rejectLOA, lockLOA, unlockLOA, downloadPPT, deleteLOA } from '@/lib/api'
import PhotoUpload from '@/components/PhotoUpload'
import { DuplicateButton, DuplicateWarningsBanner } from '@/components/DuplicateLOA'
import type { LOA } from '@/types/loa'
import { STATUS_CONFIG } from '@/types/loa'
import { ThemeToggle } from '@/components/ThemeProvider'
import { useToast } from '@/components/Toast'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import StatusHeadline from '@/components/StatusHeadline'
import WhyDisabled from '@/components/WhyDisabled'

const VALIDATION_STATUSES = new Set(['cmo_cfo_review', 'corporate_review'])
const ADVANCE_PHASE_STATUSES = new Set(['emea_review', 'global_review', 'global_functions_review'])
const ACTIONABLE_STATUSES = new Set([...VALIDATION_STATUSES, ...ADVANCE_PHASE_STATUSES])
const WORKFLOW_STEPS = [
  { key: 'draft', label: 'Created' },
  { key: 'emea_review', label: 'EMEA review' },
  { key: 'global_review', label: 'Global review' },
  { key: 'cmo_cfo_review', label: 'CMO / CFO review' },
  { key: 'global_functions_review', label: 'Global functions' },
  { key: 'corporate_review', label: 'Corporate review' },
  { key: 'approved', label: 'Approved' },
] as const
const STATUS_ORDER = WORKFLOW_STEPS.map(s => s.key)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function fmt(n: number) { if (!n) return 'EUR 0'; if (n>=1e6) return `EUR ${(n/1e6).toFixed(2)}M`; if (n>=1e3) return `EUR ${Math.round(n/1e3)}k`; return `EUR ${n}` }
function Row({label,value}:{label:string;value?:string|number|null}) { if(!value&&value!==0) return null; return (<div className="flex justify-between py-2.5" style={{borderBottom:'1px solid var(--border)'}}><span className="text-xs w-44 shrink-0" style={{color:'var(--text-muted)'}}>{label}</span><span className="text-sm text-right" style={{color:'var(--text-primary)'}}>{String(value)}</span></div>) }
function Section({title,children}:{title:string;children:React.ReactNode}) { return (<div className="card p-5 mb-3"><p className="section-heading">{title}</p>{children}</div>) }

function Timeline({loa}:{loa:LOA}) {
  const isRej = loa.status==='rejected'; const ci = STATUS_ORDER.indexOf(loa.status as any)
  return (<div style={{paddingTop:'4px'}}>
    {WORKFLOW_STEPS.map((s,i) => { const done=!isRej&&ci>=i; const cur=!isRej&&ci===i; const d=i===0?loa.created_at:i===1?loa.submitted_at:s.key==='approved'?loa.approved_at:cur?loa.updated_at:undefined; return (
      <div key={s.key} className="timeline-item"><div className="timeline-dot" style={{background:done?(cur?'var(--accent)':'var(--green)'):'transparent',border:`2px solid ${done?(cur?'var(--accent)':'var(--green)'):'var(--border-strong)'}`,boxShadow:cur?'0 0 0 3px rgba(26,26,26,0.10)':'none'}} /><div><p className="text-sm" style={{color:done?'var(--text-primary)':'var(--text-muted)',fontWeight:cur?600:400}}>{s.label}{cur&&<span className="ml-2 text-xs font-normal" style={{color:'var(--text-muted)'}}>now</span>}</p>{d&&<p className="text-xs" style={{color:'var(--text-muted)'}}>{new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>}</div></div>
    )})}
    {isRej&&(<div className="timeline-item" style={{paddingBottom:0}}><div className="timeline-dot" style={{background:'var(--red)',border:'2px solid var(--red)'}} /><div><p className="text-sm font-semibold" style={{color:'var(--red-text)'}}>Rejected</p><p className="text-xs" style={{color:'var(--text-muted)'}}>{new Date(loa.updated_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>{loa.rejection_reason&&<p className="text-xs mt-1.5 px-2 py-1.5 rounded-lg" style={{background:'var(--red-bg)',color:'var(--red-text)',border:'1px solid var(--red-border)'}}>{loa.rejection_reason}</p>}</div></div>)}
  </div>)
}

export default function LOADetailPage() {
  const params=useParams(); const router=useRouter(); const {success,error:toastError,info}=useToast(); const id=params.id as string
  const [loa,setLoa]=useState<LOA|null>(null); const [loading,setLoading]=useState(true); const [notFound,setNF]=useState(false)
  const [comment,setComment]=useState(''); const [acting,setActing]=useState(false)
  const [photos,setPhotos]=useState<{index:number;url:string}[]>([]); const {permissions,loading:permsLoading}=usePermissions(id)
  useEffect(()=>{(async()=>{try{setLoa(await getLOA(id))}catch{setNF(true)}finally{setLoading(false)}})()},[id])
  function getToken(){return typeof window!=='undefined'?localStorage.getItem('laura_token'):null}
  async function handleAdvance(){if(!loa)return;const wv=VALIDATION_STATUSES.has(loa.status);setActing(true);try{const u=await validateWorkflowStep(loa.id);setLoa(u);success(wv?'LOA approved':'Phase advanced');setComment('')}catch(e:any){const d=e.response?.data?.detail;const m=typeof d==='object'?d.message:d;toastError(typeof m==='string'?m:'Action failed')}finally{setActing(false)}}
  async function handleReject(){if(!loa||!comment.trim())return;setActing(true);try{setLoa(await rejectLOA(loa.id,comment.trim()));toastError('LOA rejected');setComment('')}catch(e:any){const d=e.response?.data?.detail;toastError(typeof d==='string'?d:'Rejection failed')}finally{setActing(false)}}
  async function handleComment(){if(!loa||!comment.trim())return;setActing(true);try{const t=getToken();const r=await fetch(`${API_BASE}/loa/${loa.id}/comment`,{method:'POST',headers:{'Content-Type':'application/json',...(t?{Authorization:`Bearer ${t}`}:{})},body:JSON.stringify({comment:comment.trim()})});if(r.ok){success('Comment saved');setComment('');setLoa(await getLOA(id))}else{const e=await r.json().catch(()=>({detail:'Failed'}));toastError(typeof e.detail==='string'?e.detail:'Failed')}}catch{toastError('Failed')}finally{setActing(false)}}
  async function handleLock(){if(!loa)return;try{setLoa(await lockLOA(loa.id));success('LOA locked')}catch{toastError('Lock failed')}}
  async function handleUnlock(){if(!loa)return;try{setLoa(await unlockLOA(loa.id));success('LOA unlocked')}catch{toastError('Unlock failed')}}
  async function handleDownloadPPT(){try{await downloadPPT(loa!.id);success('PPT downloaded')}catch{toastError('PPT download failed')}}
  async function handleDownloadExcel(){try{const t=getToken();const r=await fetch(`${API_BASE}/loa/${loa!.id}/excel`,{headers:t?{Authorization:`Bearer ${t}`}:{}});if(!r.ok)throw new Error();const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`LOA_${loa!.loa_draft_id||loa!.id}.xlsx`;a.click();URL.revokeObjectURL(u);success('Excel downloaded')}catch{toastError('Excel download failed')}}
  async function handleRevise(){info('Revise mode');router.push(`/loa/new?edit=${loa!.id}`)}
  async function handleDelete(){if(!loa)return;if(!confirm('Delete this LOA?'))return;try{await deleteLOA(loa.id);success('LOA deleted');router.push('/')}catch(e:any){toastError(e.response?.data?.detail||'Delete failed')}}

  if(loading) return <div className="min-h-screen flex items-center justify-center" style={{background:'var(--bg-base)'}}><p className="text-sm" style={{color:'var(--text-muted)'}}>Loading...</p></div>
  if(notFound||!loa) return <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{background:'var(--bg-base)'}}><p className="font-medium" style={{color:'var(--text-primary)'}}>LOA not found</p><button onClick={()=>router.push('/')} className="btn-primary">Back to tracker</button></div>

  const st=STATUS_CONFIG[loa.status]??{label:loa.status,cls:'badge-draft'}
  const isApproved=loa.status==='approved'; const isRejected=loa.status==='rejected'; const isDraft=loa.status==='draft'
  const canBeAdvanced=ACTIONABLE_STATUSES.has(loa.status); const isValidationStep=VALIDATION_STATUSES.has(loa.status)
  const advanceLabel=isValidationStep?'Approve':'Advance phase'
  const showEditButton=(isDraft||isRejected)&&!loa.is_locked
  const showCommentPanel=permissions?.can_comment&&!permissions?.can_validate&&!isDraft&&!isApproved&&!isRejected
  const categoryDisplay=Array.isArray(loa.category)?loa.category.join(' + '):loa.category

  return (
    <div className="min-h-screen page-enter" style={{background:'var(--bg-base)'}}>
      {loa.is_locked&&(<div className="px-6 py-2.5 flex items-center gap-2.5 text-sm" style={{background:'var(--amber-bg)',borderBottom:'1px solid var(--amber-border)',color:'var(--amber-text)'}}><span>This LOA is <strong>locked</strong> by a super-admin.</span></div>)}
      <header className="sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between" style={{background:'var(--bg-surface)',borderBottom:'1px solid var(--border)'}}>
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push('/')} className="btn-ghost text-sm px-2">Back</button>
          <span style={{color:'var(--border)',opacity:0.4}}>|</span>
          <span className="mono text-xs" style={{color:'var(--text-muted)'}}>{loa.loa_number||loa.loa_draft_id}</span>
          <span className={`badge ${st.cls}`}>{st.label}</span>
          {loa.is_locked&&<span className="text-xs px-2 py-0.5 rounded-full" style={{background:'var(--amber-bg)',color:'var(--amber-text)',border:'1px solid var(--amber-border)'}}>Locked</span>}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {showEditButton&&(<PermissionGuard permissions={permissions} action="edit" loading={permsLoading} hideWhileLoading><button onClick={()=>router.push(`/loa/new?edit=${loa.id}`)} className="btn-primary text-xs px-3 py-1.5">Edit</button></PermissionGuard>)}
          <PermissionGuard permissions={permissions} action="override_lock" loading={permsLoading} hideWhileLoading><button onClick={loa.is_locked?handleUnlock:handleLock} className="btn-secondary text-xs px-3 py-1.5" style={{color:loa.is_locked?'var(--amber-text)':'var(--text-secondary)',borderColor:loa.is_locked?'var(--amber-border)':undefined}}>{loa.is_locked?'Unlock':'Lock'}</button></PermissionGuard>
          <DuplicateButton loaId={loa.id} />
          {loa.status==='draft'&&(<button onClick={handleDelete} className="btn-secondary text-xs px-3 py-1.5" style={{color:'var(--red-text)',borderColor:'var(--red-border)'}}>Delete</button>)}
          {loa.ppt_slide_required&&<button onClick={handleDownloadPPT} className="btn-secondary text-xs px-3 py-1.5">PPT slide</button>}
          <button onClick={handleDownloadExcel} className="btn-secondary text-xs px-3 py-1.5">Excel</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-[1fr_300px] gap-5">
        <div>
          <StatusHeadline loa={loa} />
          <DuplicateWarningsBanner loaId={loa.id} />
          <div className="grid grid-cols-3 gap-3 mb-5">{[{label:'FY 2025',value:fmt(loa.fy_2025_total),hl:false},{label:'FY 2026',value:fmt(loa.fy_2026_total),hl:loa.ppt_slide_required},{label:'Avg / door',value:loa.avg_investment_per_door?fmt(loa.avg_investment_per_door):'-',hl:false}].map(c=>(<div key={c.label} className="card px-4 py-3"><p className="text-xs mb-1" style={{color:'var(--text-muted)'}}>{c.label}</p><p className="text-2xl font-semibold tracking-tight" style={{color:c.hl?'var(--green)':'var(--text-primary)'}}>{c.value}</p></div>))}</div>
          <Section title="Geography & Classification"><Row label="Cluster" value={loa.cluster}/><Row label="Country" value={loa.country}/><Row label="Legal entity" value={loa.legal_entity}/><Row label="Activity type" value={loa.activity_type}/><Row label="Event type" value={loa.event_type}/><Row label="Event purpose" value={loa.event_purpose}/><Row label="SAP event code" value={(loa as any).sap_event_code}/><Row label="COT" value={loa.cot}/><Row label="Category" value={categoryDisplay}/><Row label="Brand" value={loa.brand}/><Row label="CapEx / OpEx" value={loa.capex_opex}/><Row label="ADV / Selling" value={loa.adv_selling}/></Section>
          <Section title="Investment"><Row label="Customer" value={loa.customer}/><Row label="Vendor" value={loa.vendor}/><Row label="# Doors" value={loa.num_doors}/><Row label="# Customers" value={loa.num_customers}/><Row label="Currency" value={loa.currency}/><Row label="Q4 2025" value={loa.q4_2025?fmt(loa.q4_2025):undefined}/><Row label="Q1 2026" value={loa.q1_2026?fmt(loa.q1_2026):undefined}/><Row label="Q2 2026" value={loa.q2_2026?fmt(loa.q2_2026):undefined}/><Row label="Q3 2026" value={loa.q3_2026?fmt(loa.q3_2026):undefined}/><Row label="Q4 2026" value={loa.q4_2026?fmt(loa.q4_2026):undefined}/></Section>
          <Section title="Photos for PPT Slide"><p className="text-xs mb-3" style={{color:'var(--text-muted)'}}>Upload up to 2 photos - embedded automatically in the PPT when downloaded</p><PhotoUpload loaId={loa.id} onPhotosChange={setPhotos}/></Section>
          <Section title="Description & PPT Content">
            {loa.description&&(<div className="mb-4"><p className="label mb-2">Description (WHY)</p><p className="text-sm p-3 rounded-lg" style={{background:'var(--bg-elevated)',color:'var(--text-primary)'}}>{loa.description}</p></div>)}
            {loa.detail&&(<div className="mb-4"><p className="label mb-2">Detail / Tools (HOW)</p><p className="text-sm p-3 rounded-lg whitespace-pre-line" style={{background:'var(--bg-elevated)',color:'var(--text-primary)'}}>{loa.detail}</p></div>)}
            {loa.kpi&&(<div className="mb-4"><p className="label mb-2">KPI</p><p className="text-sm p-3 rounded-lg" style={{background:'var(--bg-elevated)',color:'var(--text-primary)'}}>{loa.kpi}</p></div>)}
            {(loa as any).cost_drill_down&&(<div className="mb-4"><p className="label mb-2">Cost Drill Down</p><p className="text-sm p-3 rounded-lg" style={{background:'var(--bg-elevated)',color:'var(--text-primary)'}}>{(loa as any).cost_drill_down}</p></div>)}
            {(loa as any).cmo_comment&&(<div><p className="label mb-2">Comments</p><p className="text-sm p-3 rounded-lg whitespace-pre-line" style={{background:'var(--blue-bg)',color:'var(--blue-text)',border:'1px solid var(--blue-border)'}}>{(loa as any).cmo_comment}</p></div>)}
          </Section>
        </div>
        <div className="space-y-3 sticky top-20 self-start">
          <div className="card p-5">
            <p className="section-heading">Approval</p>
            {isApproved&&(<div className="rounded-lg px-3 py-2.5 mb-4 text-sm" style={{background:'var(--green-bg)',color:'var(--green-text)',border:'1px solid var(--green-border)'}}>LOA approved</div>)}
            {isRejected&&(<><div className="rounded-lg px-3 py-2.5 mb-3 text-sm" style={{background:'var(--red-bg)',color:'var(--red-text)',border:'1px solid var(--red-border)'}}>LOA rejected{loa.rejection_reason&&<p className="mt-1 text-xs opacity-80">{loa.rejection_reason}</p>}</div><button onClick={handleRevise} className="btn-primary w-full text-sm mb-3">Revise and resubmit</button></>)}
            {isDraft&&<p className="text-sm" style={{color:'var(--text-muted)'}}>Submit this LOA to start the approval workflow.</p>}
            {canBeAdvanced&&loa.is_locked&&<p className="text-sm" style={{color:'var(--amber-text)'}}>Workflow paused - a super-admin must unlock this LOA first.</p>}
            {showCommentPanel&&(<div className="space-y-3"><p className="text-xs" style={{color:'var(--text-muted)'}}>You can leave comments for EMEA PS to review.</p><div><label className="label">Your comment</label><textarea className="input resize-none" rows={3} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Share your feedback..."/></div><button onClick={handleComment} disabled={acting||!comment.trim()} className="btn-primary w-full text-sm">{acting?'Saving...':'Save comment'}</button></div>)}
            {canBeAdvanced&&!loa.is_locked&&(<PermissionGuard permissions={permissions} action="validate" loading={permsLoading} hideWhileLoading fallback={!showCommentPanel?<WhyDisabled loa={loa} permissions={permissions}/>:null}><div className="space-y-3"><div><label className="label">Rejection reason</label><textarea className="input resize-none" rows={3} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Required to reject - leave empty to advance..."/></div><button onClick={handleAdvance} disabled={acting} className="btn-primary w-full">{acting?'Processing...':advanceLabel}</button><button onClick={handleReject} disabled={acting||!comment.trim()} className="btn-secondary w-full text-sm" style={{color:'var(--red-text)',borderColor:'var(--red-border)'}}>Reject</button></div></PermissionGuard>)}
          </div>
          <div className="card p-5"><p className="section-heading">Timeline</p><Timeline loa={loa}/></div>
          <div className="card overflow-hidden">
            <div className="px-4 py-3" style={{borderBottom:'1px solid var(--border)'}}><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>Slide preview</span></div>
            <div className="m-3 rounded-lg overflow-hidden text-[10px]" style={{border:'1px solid var(--border)'}}>
              <div className="px-3 py-1.5 flex justify-between" style={{background:'#0D1B2A'}}><span style={{color:'#aaa'}}>{categoryDisplay}</span><span className="font-semibold" style={{color:'white'}}>{loa.country} - {fmt(loa.fy_2026_total)}</span></div>
              <div className="px-3 py-1.5 font-semibold text-xs truncate" style={{color:'var(--text-primary)',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)'}}>{loa.activity_type}</div>
              <div className="grid grid-cols-2 divide-x" style={{borderColor:'var(--border)'}}>
                <div className="px-3 py-3 space-y-2" style={{background:'var(--bg-surface)'}}>{loa.description&&<div><p className="font-medium" style={{color:'var(--text-muted)'}}>Description:</p><p style={{color:'var(--text-secondary)'}}>{loa.description}</p></div>}{loa.kpi&&<div><p className="font-medium" style={{color:'var(--text-muted)'}}>KPI:</p><p style={{color:'var(--text-secondary)'}}>{loa.kpi}</p></div>}{!loa.description&&!loa.kpi&&<p style={{color:'var(--text-muted)'}}>No content yet</p>}</div>
                <div style={{background:'var(--bg-elevated)'}}>{photos.length>0?(<div className="h-full flex flex-col">{photos.map((p,i)=>(<div key={p.index} className="flex-1 overflow-hidden min-h-[40px]" style={{borderBottom:i<photos.length-1?'1px solid var(--border)':'none'}}><img src={p.url} alt="" className="w-full h-full object-cover"/></div>))}</div>):(<div className="flex items-center justify-center min-h-[80px]"><p className="text-center px-2" style={{color:'var(--text-muted)'}}>Photos (max 2)</p></div>)}</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}"""

pathlib.Path(r'frontend/src/app/loa/[id]/page.tsx').write_text(content.strip(), encoding='utf-8')
print(f'Written {len(content)} bytes')
