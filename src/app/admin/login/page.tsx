'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Login failed')
        return
      }

      router.push('/admin/dashboard')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden bg-login-hero">
      {/* Animated blobs for depth */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary opacity-10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-secondary opacity-10 rounded-full blur-3xl" />

      <div className="z-10 w-full max-w-md px-6 py-12">
        {/* Branding Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="mb-4 bg-primary p-3 rounded-xl shadow-lg">
            <Icon name="restaurant" size={36} className="text-surface" />
          </div>
          <h1 className="font-headline font-black text-4xl text-surface tracking-tighter mb-1">
            HyperBite Admin
          </h1>
          <p className="text-surface/80 font-medium text-sm">Centralized Canteen Management System</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-xl shadow-[0_20px_40px_rgba(77,33,38,0.15)] p-10 border border-white/20">
          <div className="mb-8">
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Welcome Back</h2>
            <p className="text-on-surface-variant text-sm">Please enter your credentials to access the dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-on-surface-variant ml-1" htmlFor="username">
                Username
              </label>
              <div className="relative group">
                <Icon
                  name="badge"
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors"
                />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-low border border-transparent focus:border-primary focus:ring-0 rounded-xl transition-all font-medium text-on-surface placeholder:text-on-surface-variant/40 outline-none"
                  placeholder="Enter username"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="block text-sm font-semibold text-on-surface-variant" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="relative group">
                <Icon
                  name="lock"
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-14 py-4 bg-surface-container-low border border-transparent focus:border-primary focus:ring-0 rounded-xl transition-all font-medium text-on-surface placeholder:text-on-surface-variant/40 outline-none"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-error-container/20 text-error rounded-xl px-4 py-3">
                <Icon name="error" size={18} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary text-on-primary rounded-xl font-headline font-bold text-lg shadow-lg shadow-primary/20 hover:bg-primary-dim active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Icon name="hourglass_empty" size={20} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Log In
                    <Icon name="arrow_forward" size={20} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-10 flex flex-col items-center gap-4 border-t border-outline-variant/10 pt-8">
            <button className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors text-sm font-medium">
              <Icon name="info" size={18} />
              System Info
            </button>
            <div className="flex gap-4 text-xs text-on-surface-variant/60 font-medium">
              <span>v2.4.0-Stable</span>
              <span>•</span>
              <span>St. Jude Campus</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-surface/60 text-xs font-medium uppercase tracking-widest">
          Authorized Access Only
        </p>
      </div>
    </main>
  )
}
