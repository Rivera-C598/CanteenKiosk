'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Icon } from '@/components/shared/Icon'
import { useLanguage } from '@/lib/language-context'
import { HelpModal } from '@/components/kiosk/HelpModal'
import { useStoreName } from '@/lib/store-context'
import { useCart } from '@/lib/cart-context'

interface BestSellerItem {
  id: number
  name: string
  price: number
  image: string
  totalSold: number
}

export default function WelcomePage() {
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()
  const storeName = useStoreName()
  const { addItem } = useCart()
  const [isIdle, setIsIdle] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
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

  const handleBestSellerItemTap = (item: BestSellerItem) => {
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image })
    router.push('/cart')
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
      <header className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-0 px-4 lg:px-8 py-5">
        <div className="text-3xl font-black italic text-primary tracking-tighter truncate lg:max-w-[40%] text-center lg:text-left" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {storeName}
        </div>
        <div className="glass-panel flex items-center gap-3 px-5 py-2 rounded-full">
          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
            <Icon name="school" className="text-white" size={16} />
          </div>
          <span className="font-headline font-bold text-on-surface text-sm tracking-wide" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            CTU - DANAO CAMPUS
          </span>
        </div>
        <div className="text-xl font-headline font-bold text-on-surface-variant" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {time}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex items-center justify-center h-[calc(100vh-160px)] px-4 lg:px-12 pb-24 lg:pb-0">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center justify-items-center lg:justify-items-stretch">
          {/* Left: Hero text */}
          <div className="col-span-1 lg:col-span-7 flex flex-col gap-5 items-center lg:items-start text-center lg:text-left">
            <div className="inline-flex">
              <div className="bg-primary px-5 py-1.5 rounded-full">
                <span className="text-on-primary font-headline font-extrabold text-base uppercase tracking-widest italic" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {t('welcome.favorites')}
                </span>
              </div>
            </div>
            <h1 className="font-headline font-black leading-[0.9] tracking-tighter" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 'clamp(4rem, 10vw, 8rem)' }}>
              {t('welcome.fuel')} <br />
              <span className="text-primary italic">{t('welcome.strength')}</span>
            </h1>
            <p className="text-on-surface-variant font-medium text-lg lg:text-xl max-w-md leading-relaxed mt-2" dangerouslySetInnerHTML={{ __html: t('welcome.desc') }} />
          </div>

          {/* Right: Tap to start */}
          <div className="col-span-1 lg:col-span-5 flex flex-col items-center mt-6 lg:mt-0">
            <div className="relative">
              <button
                onClick={handleStart}
                className="relative flex flex-col items-center justify-center w-72 h-72 bg-primary text-on-primary rounded-full shadow-primary-glow active:scale-95 transition-transform duration-150"
              >
                {/* Pulse ring */}
                <div className="absolute inset-0 rounded-full border-[10px] border-primary-container opacity-50 animate-pulse-ring" />
                <div className="relative flex flex-col items-center gap-3">
                  <Icon name="touch_app" className="text-on-primary" size={64} filled />
                  <span className="font-headline font-black text-2xl text-center leading-tight tracking-tight px-8" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }} dangerouslySetInnerHTML={{ __html: t('welcome.tap') }} />
                </div>
              </button>
              {/* Decorative badge */}
              <div className="absolute -bottom-3 -right-3 bg-secondary-container text-on-secondary-container px-5 py-2 rounded-full font-headline font-bold text-sm shadow-ambient" dangerouslySetInnerHTML={{ __html: t('welcome.budget') }} />
            </div>
          </div>
        </div>
      </main>

      {/* Best Sellers full-page backdrop — must be outside the widget to avoid transform clipping */}
      {showBestSellers && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-md"
          onClick={() => setShowBestSellers(false)}
        />
      )}

      {/* Best Sellers Widget */}
      {bestSellers.length > 0 && (
        <div className="absolute bottom-28 lg:bottom-24 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
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
            <div className="flex flex-col items-center gap-3">
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
                    onClick={() => handleBestSellerItemTap(item)}
                    className="shrink-0 w-36 bg-surface rounded-2xl shadow-lg border border-white/10 overflow-hidden active:scale-95 transition-transform text-left"
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
          )}
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-4 lg:bottom-8 left-0 right-0 z-10 px-4 lg:px-12 flex flex-col lg:flex-row gap-6 lg:gap-0 justify-between items-center lg:items-end">
        {/* Language */}
        <div className="flex flex-wrap justify-center lg:justify-start gap-3">
          <button 
            onClick={() => setLanguage('en')}
            className={`glass-panel px-6 py-3 rounded-full font-headline font-bold shadow-ambient flex items-center gap-2 active:scale-95 transition-transform duration-150 ${language === 'en' ? 'bg-primary/10 text-primary border-primary/20' : 'text-on-surface'}`} 
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            <Icon name="language" className={language === 'en' ? 'text-primary' : 'text-on-surface-variant'} size={20} />
            ENGLISH
          </button>
          <button 
            onClick={() => setLanguage('fil')}
            className={`glass-panel px-6 py-3 rounded-full font-headline font-bold shadow-ambient active:scale-95 transition-transform duration-150 ${language === 'fil' ? 'bg-primary/10 text-primary border-primary/20' : 'text-on-surface'}`} 
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            FILIPINO
          </button>
          <button 
            onClick={() => setLanguage('ceb')}
            className={`glass-panel px-6 py-3 rounded-full font-headline font-bold shadow-ambient active:scale-95 transition-transform duration-150 ${language === 'ceb' ? 'bg-primary/10 text-primary border-primary/20' : 'text-on-surface'}`} 
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            CEBUANO
          </button>
        </div>
        {/* Order status check */}
        <button
          onClick={() => router.push('/status')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-on-surface-variant/70 hover:text-on-surface-variant glass-panel text-xs font-bold transition-colors active:scale-95"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          <Icon name="search" size={14} />
          Check Order Status
        </button>

        {/* Support */}
        <button onClick={() => setShowHelp(true)} className="glass-panel p-4 rounded-xl flex items-center gap-3 shadow-ambient hover:bg-surface-container-low transition-colors text-left active:scale-95">
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0">
            <Icon name="contact_support" className="text-primary" size={22} />
          </div>
          <div>
            <p className="font-headline font-bold text-sm text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{t('welcome.help')}</p>
            <p className="text-xs text-on-surface-variant">{t('welcome.help_desc')}</p>
          </div>
        </button>
      </div>

      {/* Screensaver overlay */}
      {isIdle && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #b90905 0%, #4d2126 100%)' }}
          onClick={resetIdle}
        >
          <div className="flex flex-col items-center gap-8 animate-fade-in">
            <div className="text-6xl font-black italic text-white tracking-tighter truncate px-12" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {storeName}
            </div>
            <div className="w-32 h-1 bg-white/30 rounded-full" />
            <p className="text-white/80 text-2xl font-medium animate-pulse" dangerouslySetInnerHTML={{ __html: t('welcome.screensaver') }} />
            <Icon name="touch_app" className="text-white/60 mt-4" size={64} filled />
          </div>
        </div>
      )}

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
