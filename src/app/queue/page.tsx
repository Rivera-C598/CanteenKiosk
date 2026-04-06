'use client'

import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface Order {
  id: number
  orderNumber: string
  status: string
  createdAt: string
}

export default function QueuePage() {
  const [preparing, setPreparing] = useState<Order[]>([])
  const [ready, setReady] = useState<Order[]>([])
  const [time, setTime] = useState(new Date())
  const [prevReadyIds, setPrevReadyIds] = useState<Set<number>>(new Set())
  const [newlyReady, setNewlyReady] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?date=today&status=preparing,ready')
      const data: Order[] = await res.json()
      const prep = data.filter(o => o.status === 'preparing').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      const rdy = data.filter(o => o.status === 'ready').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      // Detect newly ready orders for animation
      const rdyIds = new Set(rdy.map(o => o.id))
      const newIds = new Set([...rdyIds].filter(id => !prevReadyIds.has(id)))
      if (newIds.size > 0) {
        setNewlyReady(newIds)
        // Play success chime for students to check the board
        try {
          const ctx = new AudioContext()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
          osc.type = 'sine'
          gain.gain.setValueAtTime(0, ctx.currentTime)
          gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          osc.start(ctx.currentTime)
          osc.stop(ctx.currentTime + 0.5)
        } catch {}
        
        setTimeout(() => setNewlyReady(new Set()), 3000)
      }
      setPrevReadyIds(rdyIds)
      setPreparing(prep)
      setReady(rdy)
    } catch {}
  }, [prevReadyIds])

  useEffect(() => {
    load()
    const poll = setInterval(load, 5000)
    const tick = setInterval(() => setTime(new Date()), 30000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [load])

  return (
    <div className="min-h-screen bg-background flex flex-col font-body">
      {/* Header */}
      <header className="bg-surface-container-lowest px-12 py-6 flex items-center justify-between border-b shadow-sm shrink-0 z-10 sticky top-0">
        <h1 className="font-headline font-black text-4xl text-primary tracking-tight">
          HyperBite
        </h1>
        <p className="font-headline font-black text-on-surface text-3xl">
          {time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </header>

      {/* Two columns */}
      <main className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
        {/* Preparing */}
        <div className="flex flex-col border-r border-surface-container bg-surface-container-lowest p-12">
          <div className="flex items-center gap-5 mb-10 pb-6 border-b border-surface-container">
            <div className="w-14 h-14 bg-secondary-container rounded-2xl flex items-center justify-center">
              <Icon name="cooking" size={32} className="text-secondary" />
            </div>
            <div>
              <h2 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">Preparing</h2>
              <p className="text-stone-500 font-medium text-lg uppercase tracking-widest mt-1">Order in progress</p>
            </div>
            {preparing.length > 0 && (
              <span className="ml-auto px-5 py-2 bg-secondary-container rounded-full font-headline font-black text-secondary text-2xl border border-secondary/20 shadow-inner">
                {preparing.length}
              </span>
            )}
          </div>

          {preparing.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-stone-400 gap-6">
              <Icon name="restaurant" size={80} className="opacity-20" />
              <p className="font-medium text-2xl text-stone-300 tracking-wider uppercase">Nothing Preparing</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 content-start overflow-y-auto pr-4 pb-12">
              {preparing.map(order => (
                <div
                  key={order.id}
                  className="bg-surface-container-low border border-surface-container-highest rounded-[2rem] px-8 py-5 flex items-center justify-center shadow-sm w-[calc(50%-0.6rem)] xl:w-[calc(33.333%-0.8rem)]"
                >
                  <span className="font-headline font-black text-4xl text-stone-600 tracking-tighter">
                    {order.orderNumber}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ready */}
        <div className="flex flex-col p-12 bg-tertiary-container/10">
          <div className="flex items-center gap-5 mb-10 pb-6 border-b border-tertiary/20">
            <div className="w-14 h-14 bg-tertiary rounded-2xl flex items-center justify-center shadow-md shadow-tertiary/30">
              <Icon name="check_circle" size={32} className="text-on-tertiary" />
            </div>
            <div>
              <h2 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">Ready for Pickup</h2>
              <p className="text-tertiary font-bold text-lg uppercase tracking-widest mt-1">Please proceed to counter</p>
            </div>
            {ready.length > 0 && (
              <span className="ml-auto w-14 h-14 bg-tertiary rounded-full flex items-center justify-center font-headline font-black text-on-tertiary text-2xl shadow-md">
                {ready.length}
              </span>
            )}
          </div>

          {ready.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-tertiary/40 gap-6">
              <Icon name="check_circle" size={80} className="opacity-40" />
              <p className="font-medium text-2xl tracking-wider uppercase">Nobody waiting</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-5 content-start overflow-y-auto pr-4 pb-12">
              {ready.map(order => (
                <div
                  key={order.id}
                  className={`rounded-[2rem] px-8 py-6 flex items-center justify-center transition-all duration-700 w-[calc(50%-0.8rem)] xl:w-[calc(33.333%-0.9rem)] ${newlyReady.has(order.id) ? 'bg-primary scale-110 shadow-[0_0_40px_rgba(var(--color-primary),0.5)] z-10' : 'bg-tertiary shadow-xl shadow-tertiary/20'}`}
                >
                  <span
                    className={`font-headline font-black text-6xl tracking-tighter transition-colors ${newlyReady.has(order.id) ? 'text-on-primary drop-shadow-md' : 'text-on-tertiary'}`}
                  >
                    {order.orderNumber}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-surface-container px-12 py-5 text-center shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-10 sticky bottom-0">
        <p className="text-stone-500 font-headline font-bold text-lg uppercase tracking-widest">
          When your number is called, please proceed to the counter to collect your order.
        </p>
      </footer>
    </div>
  )
}
