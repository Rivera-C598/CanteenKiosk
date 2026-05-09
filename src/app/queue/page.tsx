'use client'

import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'
import { useStoreName } from '@/lib/store-context'

interface Order {
  id: number
  orderNumber: string
  status: string
  createdAt: string
}

export default function QueuePage() {
  const storeName = useStoreName()
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
      const newIds = new Set(Array.from(rdyIds).filter(id => !prevReadyIds.has(id)))
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
        
        try {
          const numbers = Array.from(newIds).map(id => rdy.find(o => o.id === id)?.orderNumber).filter(Boolean)
          const text = `Order ${numbers.join(' and ')}, is ready for pickup!`
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.rate = 0.95
          utterance.pitch = 1.1
          window.speechSynthesis.speak(utterance)
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
    const tick = setInterval(() => setTime(new Date()), 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [load])

  return (
    <div className="min-h-screen bg-background flex flex-col font-body">
      {/* Header */}
      <header className="bg-surface-container-lowest px-4 sm:px-8 lg:px-12 py-3 sm:py-5 flex items-center justify-between border-b shadow-sm shrink-0 z-10 sticky top-0">
        <h1 className="font-headline font-black text-xl sm:text-3xl lg:text-4xl text-primary tracking-tight truncate">
          {storeName}
        </h1>
        <p className="font-headline font-black text-on-surface text-xl sm:text-2xl lg:text-3xl shrink-0">
          {time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </header>

      {/* Two columns — stacks on mobile */}
      <main className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-0 overflow-hidden">
        {/* Preparing */}
        <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-surface-container bg-surface-container-lowest p-4 sm:p-8 lg:p-12">
          <div className="flex items-center gap-3 sm:gap-5 mb-5 sm:mb-8 lg:mb-10 pb-4 sm:pb-6 border-b border-surface-container">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-secondary-container rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
              <Icon name="cooking" size={20} className="text-secondary sm:hidden" />
              <Icon name="cooking" size={32} className="text-secondary hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h2 className="font-headline font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">Preparing</h2>
              <p className="text-stone-500 font-medium text-xs sm:text-base lg:text-lg uppercase tracking-widest mt-0.5 sm:mt-1">Order in progress</p>
            </div>
            {preparing.length > 0 && (
              <span className="ml-auto px-3 sm:px-5 py-1 sm:py-2 bg-secondary-container rounded-full font-headline font-black text-secondary text-lg sm:text-2xl border border-secondary/20 shadow-inner shrink-0">
                {preparing.length}
              </span>
            )}
          </div>

          {preparing.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-stone-400 gap-4 py-8 sm:py-0">
              <Icon name="restaurant" size={48} className="opacity-20 sm:hidden" />
              <Icon name="restaurant" size={80} className="opacity-20 hidden sm:block" />
              <p className="font-medium text-lg sm:text-2xl text-stone-300 tracking-wider uppercase">Nothing Preparing</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 sm:gap-4 content-start overflow-y-auto pb-4 sm:pb-12">
              {preparing.map(order => (
                <div
                  key={order.id}
                  className="bg-surface-container-low border border-surface-container-highest rounded-2xl sm:rounded-[2rem] px-4 sm:px-8 py-3 sm:py-5 flex items-center justify-center shadow-sm w-[calc(50%-0.3rem)] sm:w-[calc(50%-0.6rem)] xl:w-[calc(33.333%-0.8rem)]"
                >
                  <span className="font-headline font-black text-2xl sm:text-4xl text-stone-600 tracking-tighter">
                    {order.orderNumber}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ready */}
        <div className="flex flex-col p-4 sm:p-8 lg:p-12 bg-tertiary-container/10">
          <div className="flex items-center gap-3 sm:gap-5 mb-5 sm:mb-8 lg:mb-10 pb-4 sm:pb-6 border-b border-tertiary/20">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-tertiary rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md shadow-tertiary/30 shrink-0">
              <Icon name="check_circle" size={20} className="text-on-tertiary sm:hidden" />
              <Icon name="check_circle" size={32} className="text-on-tertiary hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h2 className="font-headline font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">Ready</h2>
              <p className="text-tertiary font-bold text-xs sm:text-base lg:text-lg uppercase tracking-widest mt-0.5 sm:mt-1">Proceed to counter</p>
            </div>
            {ready.length > 0 && (
              <span className="ml-auto w-10 h-10 sm:w-14 sm:h-14 bg-tertiary rounded-full flex items-center justify-center font-headline font-black text-on-tertiary text-lg sm:text-2xl shadow-md shrink-0">
                {ready.length}
              </span>
            )}
          </div>

          {ready.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-tertiary/40 gap-4 py-8 sm:py-0">
              <Icon name="check_circle" size={48} className="opacity-40 sm:hidden" />
              <Icon name="check_circle" size={80} className="opacity-40 hidden sm:block" />
              <p className="font-medium text-lg sm:text-2xl tracking-wider uppercase">Nobody waiting</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 sm:gap-5 content-start overflow-y-auto pb-4 sm:pb-12">
              {ready.map(order => (
                <div
                  key={order.id}
                  className={`rounded-2xl sm:rounded-[2rem] px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-center transition-all duration-700 w-[calc(50%-0.3rem)] sm:w-[calc(50%-0.8rem)] xl:w-[calc(33.333%-0.9rem)] ${newlyReady.has(order.id) ? 'bg-primary scale-105 sm:scale-110 shadow-[0_0_40px_rgba(var(--color-primary),0.5)] z-10' : 'bg-tertiary shadow-xl shadow-tertiary/20'}`}
                >
                  <span className={`font-headline font-black text-3xl sm:text-5xl lg:text-6xl tracking-tighter transition-colors ${newlyReady.has(order.id) ? 'text-on-primary drop-shadow-md' : 'text-on-tertiary'}`}>
                    {order.orderNumber}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-surface-container px-4 sm:px-8 lg:px-12 py-3 sm:py-5 text-center shrink-0 z-10 sticky bottom-0">
        <p className="text-stone-500 font-headline font-bold text-xs sm:text-base lg:text-lg uppercase tracking-widest">
          When your number is called, please proceed to the counter.
        </p>
      </footer>
    </div>
  )
}
