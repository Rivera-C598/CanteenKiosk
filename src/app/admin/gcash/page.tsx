'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/shared/Icon'
import { DrawerPanel } from '@/components/admin/DrawerPanel'

interface GCashAccount {
  id: number
  accountName: string
  accountNumber: string
  qrCodeImage: string
  isActive: boolean
  monthlyReceived: number
  monthlyLimit: number
  lastReset: string
}

const EMPTY_FORM = { accountName: '', accountNumber: '', qrCodeImage: '', monthlyLimit: '100000' }

export default function GCashPage() {
  const [accounts, setAccounts] = useState<GCashAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<GCashAccount | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    fetch('/api/gcash')
      .then(r => r.json())
      .then(data => { setAccounts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setDrawerOpen(true) }
  const openEdit = (acc: GCashAccount) => {
    setEditing(acc)
    setForm({ accountName: acc.accountName, accountNumber: acc.accountNumber, qrCodeImage: acc.qrCodeImage, monthlyLimit: String(acc.monthlyLimit) })
    setDrawerOpen(true)
  }
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null) }

  const handleUpload = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (data.url) setForm(f => ({ ...f, qrCodeImage: data.url }))
  }

  const save = async () => {
    setSaving(true)
    const body = { ...form, monthlyLimit: parseFloat(form.monthlyLimit) }
    if (editing) {
      await fetch(`/api/gcash/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/gcash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false)
    closeDrawer()
    load()
  }

  const setActive = async (id: number) => {
    await fetch(`/api/gcash/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: true }) })
    load()
  }

  const deleteAccount = async (id: number) => {
    if (!confirm('Delete this GCash account?')) return
    await fetch(`/api/gcash/${id}`, { method: 'DELETE' })
    load()
  }

  const usagePct = (acc: GCashAccount) => Math.min(100, Math.round((acc.monthlyReceived / acc.monthlyLimit) * 100))

  if (loading && accounts.length === 0) return (
    <div className="flex items-center justify-center h-full p-8">
      <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
    </div>
  )

  const active = accounts.find(a => a.isActive)
  const inactive = accounts.filter(a => !a.isActive)

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">GCash Configuration</h2>
          <p className="text-stone-500 font-body mt-2">Manage your active and backup GCash accounts for QR payments.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-xl font-headline font-bold text-lg shadow-xl shadow-primary/20 active:scale-95 transition-transform"
        >
          <Icon name="add" size={20} />
          Add Account
        </button>
      </div>

      {accounts.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-surface-container-lowest border border-dashed border-outline-variant/30 rounded-2xl gap-4">
          <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center">
            <Icon name="qr_code" size={40} className="text-stone-400" />
          </div>
          <div className="text-center">
            <p className="font-headline font-bold text-stone-600 text-lg mb-1">No GCash Accounts</p>
            <p className="text-sm font-medium text-stone-400 max-w-sm mb-4">Add your first GCash account so students can pay via QR code on the kiosk.</p>
            <button onClick={openAdd} className="text-primary font-bold text-sm hover:underline">Setup GCash Account Now</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Active Accounts Header */}
            <h3 className="font-headline font-bold text-on-surface text-xl flex items-center gap-2">
              <Icon name="verified" size={24} className="text-tertiary" />
              Active Account
            </h3>

            {/* Active account details */}
            {active ? (
              <div className="bg-gradient-to-br from-[#006a2f] to-[#005d28] rounded-3xl p-8 text-white shadow-xl shadow-tertiary/20 relative overflow-hidden group">
                <div className="relative z-10 flex flex-col sm:flex-row items-start justify-between gap-8 w-full">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-black tracking-widest bg-white/20 px-3 py-1 rounded-full uppercase text-white backdrop-blur-sm shadow-sm">Currently Active</span>
                      <span className="text-xs font-medium text-white/80">Receiving Kiosk Payments</span>
                    </div>
                    <h3 className="font-headline font-extrabold text-4xl mt-3 mb-1 tracking-tight">{active.accountName}</h3>
                    <p className="text-white/80 font-medium font-mono text-lg">{active.accountNumber}</p>
                    
                    {/* Usage bar */}
                    <div className="mt-8 bg-black/10 p-5 rounded-2xl backdrop-blur-md border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white/90">Monthly Receiving Limit</span>
                        <span className="text-sm font-headline font-bold">₱{active.monthlyReceived.toLocaleString()} / <span className="text-white/70 font-medium">₱{active.monthlyLimit.toLocaleString()}</span></span>
                      </div>
                      <div className="h-2.5 bg-black/20 rounded-full overflow-hidden inset-shadow">
                        <div className={`h-full rounded-full transition-all duration-1000 ${usagePct(active) > 90 ? 'bg-error' : usagePct(active) > 75 ? 'bg-secondary' : 'bg-[#80ee98]'}`} style={{ width: `${usagePct(active)}%` }} />
                      </div>
                      <p className="text-xs text-white/60 mt-2 font-medium flex items-center gap-1.5">
                        <Icon name="info" size={14} />
                        Resets automatically on the first day of the month
                      </p>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button onClick={() => openEdit(active)} className="flex items-center gap-2 bg-white text-tertiary hover:bg-surface-bright px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition-colors active:scale-95">
                        <Icon name="edit" size={18} /> Edit Settings
                      </button>
                    </div>
                  </div>

                  {active.qrCodeImage && (
                    <div className="w-full sm:w-48 bg-white p-2 rounded-2xl shadow-xl shrink-0">
                      <img src={active.qrCodeImage} alt="QR" className="w-full aspect-square object-contain rounded-xl border border-stone-100" />
                      <p className="text-center tracking-widest text-[#006a2f] font-bold text-[10px] mt-2 mb-1">SCAN TO PAY</p>
                    </div>
                  )}
                </div>
                
                {/* Decorative background element matching GCash vibes mildly */}
                <Icon name="qr_code" size={300} className="absolute -bottom-10 -right-10 opacity-5 rotate-12 transition-transform duration-700 group-hover:rotate-0 pointer-events-none" />
              </div>
            ) : (
              <div className="bg-surface-container-highest p-8 rounded-2xl border border-outline-variant/30 flex items-center justify-between">
                <div>
                  <h4 className="font-headline font-bold text-stone-600 mb-1">No Active Account Selected</h4>
                  <p className="text-sm text-stone-500 font-medium">Select a backup account below to set as active, or create a new one.</p>
                </div>
                <Icon name="warning" size={32} className="text-primary opacity-50" />
              </div>
            )}

            {/* Inactive Backup Accounts */}
            <div className="mt-4 border-t border-surface-container pt-8">
              <h3 className="font-headline font-bold text-on-surface text-xl mb-4 flex items-center gap-2">
                <Icon name="cloud_sync" size={24} className="text-stone-400" />
                Backup Accounts <span className="bg-surface-container-high text-stone-500 text-xs px-2 py-0.5 rounded-full ml-1">{inactive.length}</span>
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                {inactive.map(acc => (
                  <div key={acc.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-5 hover:shadow-ambient transition-shadow group">
                    <div className="w-16 h-16 bg-surface-container-low rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-surface-container">
                      {acc.qrCodeImage ? (
                        <img src={acc.qrCodeImage} alt="QR" className="w-full h-full object-contain p-1" />
                      ) : (
                        <Icon name="qr_code" size={28} className="text-stone-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-headline font-bold text-lg text-on-surface truncate">{acc.accountName}</p>
                      <p className="text-xs text-stone-500 font-mono tracking-wide">{acc.accountNumber}</p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <div className="h-1.5 w-32 bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-stone-400 rounded-full" style={{ width: `${usagePct(acc)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase">{usagePct(acc)}% used of {acc.monthlyLimit / 1000}k</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container">
                      <button onClick={() => setActive(acc.id)} className="text-xs font-bold text-primary bg-surface-container-highest hover:bg-surface-container-high px-4 py-2.5 rounded-xl transition-colors sm:mr-2">
                        Set as Active
                      </button>
                      <button onClick={() => openEdit(acc)} className="w-9 h-9 flex items-center justify-center text-stone-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                        <Icon name="edit" size={18} />
                      </button>
                      <button onClick={() => deleteAccount(acc.id)} className="w-9 h-9 flex items-center justify-center text-stone-400 hover:text-error hover:bg-error/10 rounded-lg transition-all">
                        <Icon name="delete" size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {inactive.length === 0 && active && (
                  <div className="py-8 text-center border-2 border-dashed border-surface-container rounded-2xl text-stone-400">
                    <p className="text-sm font-medium">No backup accounts available.</p>
                    <p className="text-xs mt-1">We recommend having at least one backup account for continuous operations.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-4">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 sticky top-24">
              <div className="w-12 h-12 bg-secondary-container/20 text-secondary rounded-2xl flex items-center justify-center mb-4">
                <Icon name="tips_and_updates" size={24} />
              </div>
              <h4 className="font-headline font-bold text-on-surface mb-2">How GCash Limits Work</h4>
              <p className="text-sm text-stone-500 font-medium leading-relaxed mb-4">
                Personal GCash accounts have a strict ₱100,000 monthly incoming limit. The kiosk helps track this usage.
              </p>
              <ul className="text-sm text-stone-500 space-y-3 font-medium">
                <li className="flex gap-2.5">
                  <span className="text-tertiary mt-0.5">•</span>
                  Configure multiple backup accounts to ensure student payments don't bounce.
                </li>
                <li className="flex gap-2.5">
                  <span className="text-tertiary mt-0.5">•</span>
                  When the active account approaches 100%, manually swap to a backup account here.
                </li>
                <li className="flex gap-2.5">
                  <span className="text-tertiary mt-0.5">•</span>
                  Usage resets automatically each month.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <DrawerPanel open={drawerOpen} onClose={closeDrawer} title={editing ? 'Edit Account' : 'Add GCash Account'}>
        <div className="flex flex-col gap-6 pt-2">
          {/* QR upload */}
          <div>
            <label className="text-sm font-bold text-on-surface-variant mb-2 block">QR Code Image</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full h-48 bg-surface-container-lowest border border-dashed border-outline-variant/50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-low transition-colors overflow-hidden relative shadow-sm"
            >
              {form.qrCodeImage ? (
                <img src={form.qrCodeImage} alt="QR preview" className="w-full h-full object-contain p-4 mix-blend-multiply" />
              ) : uploading ? (
                <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
              ) : (
                <>
                  <Icon name="qr_code_scanner" size={40} className="text-stone-400" />
                  <span className="text-xs text-stone-500 mt-2 font-medium block">Click to upload saved QR code</span>
                  <span className="text-[10px] text-stone-400 block mt-1">Accepts JPG, PNG</span>
                </>
              )}
              {form.qrCodeImage && (
                <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, qrCodeImage: '' })) }} className="absolute top-3 right-3 w-8 h-8 bg-surface/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
                  <Icon name="close" size={16} className="text-on-surface" />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          </div>

          {[
            { label: 'Account Name', key: 'accountName', placeholder: 'e.g. Juan dela Cruz', type: 'text' },
            { label: 'GCash Number', key: 'accountNumber', placeholder: 'e.g. 0917 XXX XXXX', type: 'text' },
            { label: 'Monthly Received Limit (₱)', key: 'monthlyLimit', placeholder: '100000', type: 'number' },
          ].map(field => (
            <div key={field.key}>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={(form as any)[field.key]}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}

          <button
            onClick={save}
            disabled={saving || !form.accountName || !form.accountNumber}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-headline font-bold disabled:opacity-50 active:scale-95 transition-transform mt-4 shadow-lg shadow-primary/20"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add GCash Account'}
          </button>
        </div>
      </DrawerPanel>
    </div>
  )
}
