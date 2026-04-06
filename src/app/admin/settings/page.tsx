'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface Settings {
  idleTimeoutSeconds: number
  gcashPaymentTimeoutMinutes: number
  receiptFooterMessage: string
  alwaysOpen: boolean
  openTime: string
  closeTime: string
}

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setForm)
  }, [])

  const save = async () => {
    if (!form) return
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!form) return (
    <div className="flex items-center justify-center h-full p-8">
      <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h2 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">System Settings</h2>
        <p className="text-stone-500 font-body mt-2">Kiosk behaviour, time restrictions, and receipt display configuration.</p>
      </div>

      <div className="space-y-6">
        {/* Kiosk timings */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-surface-container flex justify-center items-center rounded-xl text-stone-500">
              <Icon name="timer" size={20} />
            </div>
            <h3 className="font-headline font-bold text-on-surface text-xl">Kiosk Timings</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-1 block">Idle Timeout (seconds)</label>
              <p className="text-xs text-stone-400 mb-3 font-medium">How long before the order flow resets to the home screensaver.</p>
              <input
                type="number"
                value={form.idleTimeoutSeconds}
                onChange={e => setForm(f => f ? { ...f, idleTimeoutSeconds: Number(e.target.value) } : f)}
                className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-1 block">GCash Payment Timeout (minutes)</label>
              <p className="text-xs text-stone-400 mb-3 font-medium">Time before an unconfirmed GCash order is auto-cancelled.</p>
              <input
                type="number"
                value={form.gcashPaymentTimeoutMinutes}
                onChange={e => setForm(f => f ? { ...f, gcashPaymentTimeoutMinutes: Number(e.target.value) } : f)}
                className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </section>

        {/* Operating hours */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-8 flex flex-col items-start min-h-[160px] transition-all">
          <div className="flex items-center justify-between mb-2 w-full">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-surface-container flex justify-center items-center rounded-xl text-stone-500">
                <Icon name="storefront" size={20} />
              </div>
              <h3 className="font-headline font-bold text-on-surface text-xl">Operating Hours</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-on-surface">Always Open</p>
                <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Disable Restrictions</p>
              </div>
              <button
                onClick={() => setForm(f => f ? { ...f, alwaysOpen: !f.alwaysOpen } : f)}
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner shadow-black/10 ${form.alwaysOpen ? 'bg-tertiary' : 'bg-stone-300'}`}
              >
                <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform shadow-md ${form.alwaysOpen ? 'translate-x-[26px]' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          
          <div className={`w-full overflow-hidden transition-all duration-300 ${form.alwaysOpen ? 'max-h-0 opacity-0 mt-0 pointer-events-none' : 'max-h-40 opacity-100 mt-6'}`}>
            <div className="grid grid-cols-2 gap-6 bg-surface-container-low/30 p-6 rounded-xl border border-surface-container-high/50">
              <div>
                <label className="text-sm font-bold text-stone-500 mb-2 block">Opening Time</label>
                <input type="time" value={form.openTime} onChange={e => setForm(f => f ? { ...f, openTime: e.target.value } : f)} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-sm font-bold text-stone-500 mb-2 block">Closing Time</label>
                <input type="time" value={form.closeTime} onChange={e => setForm(f => f ? { ...f, closeTime: e.target.value } : f)} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </div>
        </section>

        {/* Receipt */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-surface-container flex justify-center items-center rounded-xl text-stone-500">
              <Icon name="receipt" size={20} />
            </div>
            <h3 className="font-headline font-bold text-on-surface text-xl">Receipt Formatting</h3>
          </div>
          <div>
            <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Footer Message</label>
            <p className="text-xs text-stone-400 mb-3 font-medium">Text printed at the bottom of thermal receipts given to students.</p>
            <input
              type="text"
              value={form.receiptFooterMessage}
              onChange={e => setForm(f => f ? { ...f, receiptFooterMessage: e.target.value } : f)}
              placeholder="e.g. Thank you for eating at the Canteen!"
              className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </section>

        {/* Save */}
        <div className="pt-4 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className={`flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-headline font-bold shadow-lg active:scale-95 transition-all w-full sm:w-auto min-w-[200px] ${saved ? 'bg-[#80ee98] text-[#005d28] shadow-[#80ee98]/20' : 'bg-primary text-on-primary shadow-primary/20 disabled:opacity-50'}`}
          >
            {saved ? <><Icon name="check" size={20} /> Settings Saved</> : saving ? 'Saving…' : <><Icon name="save" size={20} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}
