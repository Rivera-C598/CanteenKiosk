'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface Settings {
  storeName: string
  idleTimeoutSeconds: number
  gcashPaymentTimeoutMinutes: number
  receiptFooterMessage: string
  alwaysOpen: boolean
  openTime: string
  closeTime: string
  requireAllItemsChecked: boolean
}

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetModal, setResetModal] = useState<{ isOpen: boolean; action: 'clear' | 'seed' | null; input: string; error: string; success?: boolean }>({ isOpen: false, action: null, input: '', error: '' })

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

  const openResetModal = (action: 'clear' | 'seed') => {
    setResetModal({ isOpen: true, action, input: '', error: '' })
  }

  const confirmReset = async () => {
    if (!resetModal.action) return
    const word = resetModal.action === 'clear' ? 'CLEAR-DB' : 'LOAD-DEMO'
    if (resetModal.input !== word) {
      setResetModal(prev => ({ ...prev, error: "Incorrect confirmation word." }))
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/system/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: resetModal.action, confirm: resetModal.input })
      })
      const data = await res.json()
      if (res.ok) {
        setResetModal(prev => ({ ...prev, error: '', success: true }))
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setResetModal(prev => ({ ...prev, error: "Error: " + data.error }))
      }
    } catch {
      setResetModal(prev => ({ ...prev, error: "Network error occurred." }))
    } finally {
      setSaving(false)
    }
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
        {/* Brand identity */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-surface-container flex justify-center items-center rounded-xl text-stone-500">
              <Icon name="store" size={20} />
            </div>
            <h3 className="font-headline font-bold text-on-surface text-xl">Brand Identity</h3>
          </div>
          <div>
            <label className="text-sm font-bold text-on-surface-variant mb-1 block">Store / Brand Name</label>
            <p className="text-xs text-stone-400 mb-3 font-medium">This name will automatically appear on the Welcome Screen, the Kitchen App, the TV Queue display, and your receipt branding.</p>
            <input
              type="text"
              value={form.storeName}
              onChange={e => setForm(f => f ? { ...f, storeName: e.target.value } : f)}
              className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-bold"
              placeholder="e.g. CTU FoodHub"
            />
          </div>
        </section>

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
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner shadow-black/10 flex items-center ${form.alwaysOpen ? 'bg-tertiary' : 'bg-stone-300'}`}
              >
                <span className={`absolute left-0 w-6 h-6 rounded-full bg-white transition-transform shadow-md ${form.alwaysOpen ? 'translate-x-7' : 'translate-x-1'}`} />
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

        {/* Operator Behavior */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-surface-container flex justify-center items-center rounded-xl text-stone-500">
              <Icon name="rule" size={20} />
            </div>
            <h3 className="font-headline font-bold text-on-surface text-xl">Operator Behavior</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-8">
              <p className="font-bold text-sm text-on-surface">Require All Items Checked</p>
              <p className="text-xs text-stone-400 font-medium mt-1">
                When enabled, canteen staff must check off every item in an order before they can confirm it.
              </p>
            </div>
            <button
              onClick={() => setForm(f => f ? { ...f, requireAllItemsChecked: !f.requireAllItemsChecked } : f)}
              className={`w-14 h-8 rounded-full transition-colors relative shadow-inner shadow-black/10 flex items-center shrink-0 ${form.requireAllItemsChecked ? 'bg-tertiary' : 'bg-stone-300'}`}
            >
              <span className={`absolute left-0 w-6 h-6 rounded-full bg-white transition-transform shadow-md ${form.requireAllItemsChecked ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-error-container/10 rounded-2xl shadow-sm border border-error/20 p-8 mt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-error/10 flex justify-center items-center rounded-xl text-error">
              <Icon name="warning" size={20} />
            </div>
            <h3 className="font-headline font-bold text-error text-xl">Danger Zone</h3>
          </div>
          <p className="text-sm font-medium text-on-surface-variant mb-6">
            These actions are irreversible. They will immediately alter the live database.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => openResetModal('clear')}
              disabled={saving}
              className="flex-1 bg-white border border-error text-error py-3 rounded-xl font-headline font-bold hover:bg-error/10 active:scale-95 transition-all text-sm disabled:opacity-50"
            >
              Fresh Start (Clear Data)
            </button>
            <button
              onClick={() => openResetModal('seed')}
              disabled={saving}
              className="flex-1 bg-error text-white py-3 rounded-xl font-headline font-bold shadow-lg shadow-error/20 hover:bg-error/90 active:scale-95 transition-all text-sm disabled:opacity-50"
            >
              Load Demo Data
            </button>
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

      {/* Danger Modal */}
      {resetModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center mb-4 text-error mx-auto">
              <Icon name="warning" size={24} />
            </div>
            <h3 className="font-headline font-black text-2xl text-center text-error mb-2 tracking-tight">Are you absolutely sure?</h3>
            <p className="text-sm text-center text-on-surface-variant font-medium mb-6">
              This action cannot be undone. It will immediately alter the live database.
            </p>
            <div className="mb-6 bg-surface-container-lowest p-4 border border-outline-variant/20 rounded-xl text-center shadow-inner">
              <span className="text-xs text-stone-500 uppercase tracking-widest font-bold">Type exactly to confirm:</span>
              <p className="font-mono font-bold text-xl text-on-surface select-all mt-1">
                {resetModal.action === 'clear' ? 'CLEAR-DB' : 'LOAD-DEMO'}
              </p>
            </div>
            <input
              type="text"
              value={resetModal.input}
              onChange={e => setResetModal({ ...resetModal, input: e.target.value, error: '' })}
              placeholder="Confirm code"
              className={`w-full bg-background border ${resetModal.error ? 'border-error ring-1 ring-error' : 'border-outline-variant/30'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-error focus:ring-1 focus:ring-error mb-2 font-mono text-center font-black`}
              autoFocus
            />
            {resetModal.error && <p className="text-xs text-center font-bold text-error mb-2">{resetModal.error}</p>}
            {resetModal.success && <p className="text-xs text-center font-bold text-primary mb-2">Success! Reloading...</p>}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setResetModal({ ...resetModal, isOpen: false })}
                disabled={saving || resetModal.success}
                className="flex-1 py-3.5 text-sm font-bold text-on-surface bg-surface-container-low hover:bg-surface-container active:scale-95 rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                disabled={saving || resetModal.success || !resetModal.input}
                className="flex-1 py-3.5 text-sm font-bold bg-error text-white rounded-xl shadow-lg shadow-error/20 hover:bg-error/90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? 'Working...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
