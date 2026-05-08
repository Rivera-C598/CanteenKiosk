'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'
import jsQR from 'jsqr'
import { useCart } from '@/lib/cart-context'

type Stage = 'scanning' | 'confirm' | 'pin' | 'processing' | 'success' | 'error'

interface StudentInfo {
  id: number
  fullName: string
  studentIdNumber: string
  accountType: string
  photoUrl: string
  balance: number
}

function CashlessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clearCart } = useCart()
  const orderNumber = searchParams.get('order') ?? ''
  const amount = parseFloat(searchParams.get('amount') ?? '0')
  const orderId = parseInt(searchParams.get('orderId') ?? '0')

  const [stage, setStage] = useState<Stage>('scanning')
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [scannedToken, setScannedToken] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [lockMsg, setLockMsg] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const scannedRef = useRef(false)

  useEffect(() => {
    if (stage !== 'scanning') return
    scannedRef.current = false

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        const scan = () => {
          if (scannedRef.current || !videoRef.current) return
          const video = videoRef.current
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(imageData.data, imageData.width, imageData.height)
            if (code?.data) {
              scannedRef.current = true
              stopStream()
              handleScan(code.data)
              return
            }
          }
          animRef.current = requestAnimationFrame(scan)
        }
        animRef.current = requestAnimationFrame(scan)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`Camera error: ${msg}`)
      }
    }

    start()

    return () => {
      scannedRef.current = true
      cancelAnimationFrame(animRef.current)
      stopStream()
    }
  }, [stage])

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const handleScan = async (qrToken: string) => {
    setError('')
    const res = await fetch('/api/cashless/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Invalid QR')
      setStage('error')
      return
    }
    setStudent(data)
    setScannedToken(qrToken)
    setStage('confirm')
  }

  const handlePay = async () => {
    if (pin.length < 4) { setError('Enter your PIN'); return }
    setStage('processing')
    setError('')
    const res = await fetch('/api/cashless/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken: scannedToken, pin, orderId }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 429) setLockMsg(data.error)
      else setError(data.error ?? 'Payment failed')
      setStage('pin')
      return
    }
    setStage('success')
    clearCart()
    setTimeout(() => {
      router.push(`/confirmed?order=${orderNumber}&method=cashless&amount=${amount}`)
    }, 2000)
  }

  const addPinDigit = (d: string) => { if (pin.length < 4) setPin(p => p + d) }
  const delPinDigit = () => setPin(p => p.slice(0, -1))

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-3 sm:py-4 bg-surface-container-low shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled', cancelReason: 'customer_cancelled' }) })
              router.push('/cart')
            }}
            className="flex items-center gap-1.5 text-on-surface-variant active:scale-95 transition-transform text-sm font-medium"
          >
            <Icon name="shopping_cart" size={20} /> Cart
          </button>
          <span className="text-surface-container-high">·</span>
          <button
            onClick={async () => {
              await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled', cancelReason: 'customer_cancelled' }) })
              router.push('/payment')
            }}
            className="flex items-center gap-1.5 text-on-surface-variant active:scale-95 transition-transform text-sm font-medium"
          >
            <Icon name="swap_horiz" size={20} /> Change
          </button>
          <span className="text-surface-container-high">·</span>
          <button
            onClick={async () => {
              await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled', cancelReason: 'customer_cancelled' }) })
              router.push('/')
            }}
            className="flex items-center gap-1.5 text-error active:scale-95 transition-transform text-sm font-medium"
          >
            <Icon name="close" size={20} /> Cancel
          </button>
        </div>
        <div className="text-xl sm:text-2xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Cashless Pay
        </div>
        <div className="w-16" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 gap-6 overflow-y-auto">

        {/* Amount */}
        <div className="text-center">
          <p className="text-on-surface-variant font-medium mb-1">Order {orderNumber}</p>
          <p className="font-headline font-black text-5xl text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            ₱{amount.toFixed(2)}
          </p>
        </div>

        {/* SCANNING stage */}
        {stage === 'scanning' && (
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <p className="text-on-surface-variant text-sm text-center">Hold your QR card in front of the camera</p>
            <div className="relative w-72 h-72 rounded-2xl overflow-hidden bg-surface-container shadow-ambient">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              {/* Viewfinder overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-primary rounded-xl opacity-70" />
              </div>
            </div>
            {error && <p className="text-error text-sm text-center">{error}</p>}
          </div>
        )}

        {/* CONFIRM stage */}
        {stage === 'confirm' && student && (
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <div className="w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center gap-4">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                  <Icon name="person" size={32} className="text-on-surface-variant" />
                </div>
              )}
              <div>
                <p className="font-black text-on-surface text-lg" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{student.fullName}</p>
                <p className="text-on-surface-variant text-sm">{student.studentIdNumber} · {student.accountType}</p>
                <p className="text-primary font-bold mt-1">Balance: ₱{student.balance.toFixed(2)}</p>
              </div>
            </div>

            {student.balance < amount && (
              <div className="w-full p-4 bg-error-container rounded-xl text-on-error-container text-sm text-center">
                <p className="font-bold mb-2">Insufficient balance (₱{student.balance.toFixed(2)} available)</p>
                <button
                  onClick={async () => {
                    await fetch(`/api/orders/${orderId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'cancelled', cancelReason: 'insufficient_balance' }),
                    })
                    router.push('/payment')
                  }}
                  className="bg-error text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                >
                  Change Payment Method
                </button>
              </div>
            )}

            <p className="text-on-surface-variant text-sm text-center">Is this the right person?</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => { setStage('scanning'); setStudent(null) }}
                className="flex-1 bg-surface-container text-on-surface rounded-xl py-4 font-bold active:scale-95 transition-transform">
                Not me
              </button>
              <button
                onClick={() => { if (student.balance >= amount) setStage('pin') }}
                disabled={student.balance < amount}
                className="flex-1 bg-primary text-on-primary rounded-xl py-4 font-bold shadow-primary-glow active:scale-95 disabled:opacity-40 transition-transform">
                Correct
              </button>
            </div>
          </div>
        )}

        {/* PIN stage */}
        {(stage === 'pin' || stage === 'processing') && student && (
          <div className="w-full max-w-xs flex flex-col items-center gap-6">
            <div className="text-center">
              <p className="text-on-surface font-bold">{student.fullName}</p>
              <p className="text-on-surface-variant text-sm">Enter your PIN to pay ₱{amount.toFixed(2)}</p>
            </div>

            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? 'bg-primary' : 'bg-surface-container'}`} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 w-full">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
                <button
                  key={i}
                  onClick={() => d === '⌫' ? delPinDigit() : d ? addPinDigit(d) : null}
                  disabled={stage === 'processing' || !d}
                  className={`py-4 rounded-xl font-black text-2xl transition-all active:scale-95 ${
                    d === '⌫' ? 'bg-surface-container text-on-surface' :
                    d ? 'bg-surface-container-lowest text-on-surface shadow-ambient' : 'invisible'
                  } disabled:opacity-40`}
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {d}
                </button>
              ))}
            </div>

            {error && <p className="text-error text-sm text-center">{error}</p>}
            {lockMsg && <p className="text-error text-sm text-center">{lockMsg}</p>}

            <button
              onClick={handlePay}
              disabled={pin.length < 4 || stage === 'processing'}
              className="w-full bg-primary text-on-primary rounded-xl py-4 font-black text-xl shadow-primary-glow active:scale-[0.98] disabled:opacity-40 transition-transform flex items-center justify-center gap-3"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {stage === 'processing' ? (
                <><Icon name="hourglass_empty" size={24} className="animate-spin" /> Processing…</>
              ) : (
                <><Icon name="check_circle" size={24} filled /> Pay ₱{amount.toFixed(2)}</>
              )}
            </button>

            <button onClick={() => { setStage('scanning'); setStudent(null); setPin('') }}
              className="text-on-surface-variant text-sm">
              Cancel
            </button>
          </div>
        )}

        {/* SUCCESS stage */}
        {stage === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <Icon name="check_circle" size={80} className="text-primary" filled />
            <p className="font-black text-2xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Payment Successful!</p>
            <p className="text-on-surface-variant text-sm">Redirecting…</p>
          </div>
        )}

        {/* ERROR stage */}
        {stage === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <Icon name="error" size={64} className="text-error" />
            <p className="text-error font-bold text-lg text-center">{error}</p>
            <button onClick={() => { setStage('scanning'); setError('') }}
              className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold shadow-primary-glow">
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default function CashlessPage() {
  return (
    <Suspense>
      <CashlessContent />
    </Suspense>
  )
}
