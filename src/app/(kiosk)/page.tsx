'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Icon } from '@/components/shared/Icon'

interface BestSellerItem {
  id: number
  name: string
  price: number
  image: string
  totalSold: number
}

export default function WelcomePage() {
  const router = useRouter()
  const [isIdle, setIsIdle] = useState(false)
  const [time, setTime] = useState('')
  const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([])
  const [showBestSellers, setShowBestSellers] = useState(false)

  const resetIdle = useCallback(() => {
    setIsIdle(false)
  }, [])

  useEffect(() => {
    // Clock
    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }))
    }
    updateTime()
    const clockInterval = setInterval(updateTime, 1000)

    // Idle timer
    let idleTimeout: NodeJS.Timeout
    const startIdleTimer = () => {
      clearTimeout(idleTimeout)
      idleTimeout = setTimeout(() => setIsIdle(true), 90000)
    }
    startIdleTimer()

    const handleActivity = () => {
      setIsIdle(false)
      startIdleTimer()
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('touchstart', handleActivity)
    window.addEventListener('click', handleActivity)

    return () => {
      clearInterval(clockInterval)
      clearTimeout(idleTimeout)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      window.removeEventListener('click', handleActivity)
    }
  }, [])

  useEffect(() => {
    fetch('/api/orders/best-sellers?days=7')
      .then(r => r.json())
      .then(data => setBestSellers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const handleStart = () => {
    router.push('/menu')
  }

  const handleBestSellerItemTap = (itemId: number) => {
    sessionStorage.setItem('kiosk_preselect_item', String(itemId))
    router.push('/menu')
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-surface select-none">
      {/* Background gradient */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse at 70% 50%, #ff7764 0%, #b90905 45%, #4d2126 100%)',
          opacity: 0.12,
        }}
      />
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, #fff4f4 0%, #ffeced 40%, #ffd2d4 100%)',
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="text-3xl font-black italic text-primary tracking-tighter" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          HyperBite
        </div>
        <div className="glass-panel flex items-center gap-3 px-5 py-2 rounded-full">
          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
            <Icon name="school" className="text-white" size={16} />
          </div>
          <span className="font-headline font-bold text-on-surface text-sm tracking-wide" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            UNIVERSITY CAMPUS KIOSK
          </span>
        </div>
        <div className="text-xl font-headline font-bold text-on-surface-variant" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {time}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex items-center justify-center h-[calc(100vh-160px)] px-12">
        <div className="w-full max-w-6xl grid grid-cols-12 gap-8 items-center">
          {/* Left: Hero text */}
          <div className="col-span-7 flex flex-col gap-5">
            <div className="inline-flex">
              <div className="bg-primary px-5 py-1.5 rounded-full">
                <span className="text-on-primary font-headline font-extrabold text-base uppercase tracking-widest italic" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Student Favorites
                </span>
              </div>
            </div>
            <h1 className="font-headline font-black leading-[0.9] tracking-tighter" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 'clamp(4rem, 10vw, 8rem)' }}>
              FUEL YOUR <br />
              <span className="text-primary italic">STRENGTH.</span>
            </h1>
            <p className="text-on-surface-variant font-medium text-xl max-w-md leading-relaxed mt-2">
              The ultimate campus dining experience. Freshly made, lightning fast, and student-budget friendly.
            </p>
          </div>

          {/* Right: Tap to start */}
          <div className="col-span-5 flex flex-col items-center">
            <div className="relative">
              <button
                onClick={handleStart}
                className="relative flex flex-col items-center justify-center w-72 h-72 bg-primary text-on-primary rounded-full shadow-primary-glow active:scale-95 transition-transform duration-150"
              >
                {/* Pulse ring */}
                <div className="absolute inset-0 rounded-full border-[10px] border-primary-container opacity-50 animate-pulse-ring" />
                <div className="relative flex flex-col items-center gap-3">
                  <Icon name="touch_app" className="text-on-primary" size={64} filled />
                  <span className="font-headline font-black text-2xl text-center leading-tight tracking-tight px-8" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    TAP HERE <br /> TO START
                  </span>
                </div>
              </button>
              {/* Decorative badge */}
              <div className="absolute -bottom-3 -right-3 bg-secondary-container text-on-secondary-container px-5 py-2 rounded-full font-headline font-bold text-sm shadow-ambient">
                STUDENT BUDGET FRIENDLY
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Best Sellers Widget */}
      {bestSellers.length > 0 && (
        <div className="absolute bottom-28 lg:bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          {/* Collapsed pill */}
          {!showBestSellers && (
            <button
              onClick={() => setShowBestSellers(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm text-primary font-bold text-sm animate-pulse hover:bg-primary/20 active:scale-95 transition-all"
            >
              <Icon name="star" size={16} className="text-primary" />
              Best Sellers Right Now
              <Icon name="keyboard_arrow_down" size={16} className="text-primary" />
            </button>
          )}

          {/* Expanded carousel */}
          {showBestSellers && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowBestSellers(false)} />
              <div className="relative z-40 flex flex-col items-center gap-3">
                <button
                  onClick={() => setShowBestSellers(false)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all"
                >
                  <Icon name="star" size={16} className="text-on-primary" />
                  Best Sellers Right Now
                  <Icon name="keyboard_arrow_up" size={16} className="text-on-primary" />
                </button>
                <div className="flex gap-3 overflow-x-auto pb-1 max-w-[90vw]">
                  {bestSellers.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleBestSellerItemTap(item.id)}
                      className="shrink-0 w-36 bg-surface/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/10 overflow-hidden active:scale-95 transition-transform text-left"
                    >
                      <div className="w-full h-24 bg-surface-container flex items-center justify-center overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="restaurant" size={32} className="text-outline" />
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-on-surface text-xs leading-tight line-clamp-2">
                          {item.name}
                        </p>
                        <p className="font-black text-primary text-sm mt-1">
                          ₱{item.price.toFixed(0)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-8 left-0 right-0 z-10 px-12 flex justify-between items-end">
        {/* Language */}
        <div className="flex gap-3">
          <button className="glass-panel px-6 py-3 rounded-full font-headline font-bold text-on-surface shadow-ambient flex items-center gap-2 active:scale-95 transition-transform duration-150" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            <Icon name="language" className="text-primary" size={20} />
            ENGLISH
          </button>
          <button className="glass-panel px-6 py-3 rounded-full font-headline font-bold text-on-surface shadow-ambient active:scale-95 transition-transform duration-150" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            FILIPINO
          </button>
        </div>
        {/* Support */}
        <div className="glass-panel p-4 rounded-xl flex items-center gap-3 shadow-ambient">
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
            <Icon name="contact_support" className="text-primary" size={22} />
          </div>
          <div>
            <p className="font-headline font-bold text-sm text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Need help ordering?</p>
            <p className="text-xs text-on-surface-variant">Touch for assistance</p>
          </div>
        </div>
      </div>

      {/* Screensaver overlay */}
      {isIdle && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #b90905 0%, #4d2126 100%)' }}
          onClick={resetIdle}
        >
          <div className="flex flex-col items-center gap-8 animate-fade-in">
            <div className="text-6xl font-black italic text-white tracking-tighter" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              HyperBite
            </div>
            <div className="w-32 h-1 bg-white/30 rounded-full" />
            <p className="text-white/80 text-2xl font-medium animate-pulse">
              Tap anywhere to order
            </p>
            <Icon name="touch_app" className="text-white/60 mt-4" size={64} filled />
          </div>
        </div>
      )}
    </div>
  )
}
