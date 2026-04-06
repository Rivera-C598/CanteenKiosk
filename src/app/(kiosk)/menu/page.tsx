'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'
import { useCart } from '@/lib/cart-context'

interface MenuItem {
  id: number
  name: string
  description: string
  price: number
  image: string
  available: boolean
  stock: number
}

interface Category {
  id: number
  name: string
  icon: string
  items: MenuItem[]
}

export default function MenuPage() {
  const router = useRouter()
  const { addItem, totalItems, totalAmount } = useCart()
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [addedId, setAddedId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        setCategories(data)
        if (data.length > 0) setActiveCategory(data[0].id)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const activeItems = categories.find(c => c.id === activeCategory)?.items ?? []

  const handleAdd = (item: MenuItem) => {
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image })
    setAddedId(item.id)
    setTimeout(() => setAddedId(null), 600)
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Icon name="restaurant" className="text-primary animate-pulse" size={48} />
          <p className="font-headline font-bold text-on-surface-variant" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Loading menu…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-surface-container-low shrink-0">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-on-surface-variant active:scale-95 transition-transform"
        >
          <Icon name="arrow_back" className="text-on-surface-variant" size={24} />
          <span className="font-body text-sm font-medium">Back</span>
        </button>
        <div className="text-2xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          HyperBite
        </div>
        <div className="w-20" />
      </header>

      {/* Category tabs */}
      <div className="shrink-0 px-6 py-3 overflow-x-auto flex gap-3 scrollbar-none bg-surface-container-low border-b-0">
        <div className="flex gap-3">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-headline font-bold text-sm whitespace-nowrap active:scale-95 transition-all duration-150 ${
                activeCategory === cat.id
                  ? 'bg-primary text-on-primary shadow-primary-glow'
                  : 'bg-surface-container-lowest text-on-surface-variant shadow-ambient'
              }`}
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              <Icon name={cat.icon || 'restaurant'} size={18} filled={activeCategory === cat.id} className={activeCategory === cat.id ? 'text-on-primary' : 'text-on-surface-variant'} />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5 pb-28">
        {activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-variant">
            <Icon name="restaurant_menu" size={48} />
            <p className="font-headline font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>No items in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {activeItems.map(item => (
              <div
                key={item.id}
                className={`food-card relative flex flex-col ${!item.available || item.stock === 0 ? 'opacity-50' : ''}`}
              >
                {/* Placeholder image area */}
                <div className="w-full aspect-square bg-surface-container flex items-center justify-center rounded-t-xl overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="restaurant" className="text-outline" size={48} />
                  )}
                </div>
                {/* Sold-out overlay */}
                {(!item.available || item.stock === 0) && (
                  <div className="absolute inset-0 bg-surface/60 rounded-xl flex items-center justify-center">
                    <span className="bg-error text-on-error text-xs font-bold px-3 py-1 rounded-full" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>SOLD OUT</span>
                  </div>
                )}
                {/* Card body */}
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <h3 className="font-headline font-bold text-on-surface text-sm leading-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-1">
                    <span className="font-headline font-black text-primary text-lg" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      ₱{item.price.toFixed(0)}
                    </span>
                    <button
                      onClick={() => handleAdd(item)}
                      disabled={!item.available || item.stock === 0}
                      className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all duration-150 ${
                        addedId === item.id
                          ? 'bg-tertiary text-on-tertiary'
                          : 'bg-primary text-on-primary shadow-primary-glow'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Icon name={addedId === item.id ? 'check' : 'add'} size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating cart bar */}
      {totalItems > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
          <button
            onClick={() => router.push('/cart')}
            className="w-full bg-primary text-on-primary rounded-xl px-6 py-4 flex items-center justify-between shadow-primary-glow active:scale-[0.98] transition-transform duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <span className="font-headline font-black text-sm">{totalItems}</span>
              </div>
              <span className="font-headline font-bold text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>View Order</span>
            </div>
            <span className="font-headline font-black text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>₱{totalAmount.toFixed(0)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
