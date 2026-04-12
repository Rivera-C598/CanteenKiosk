'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface MenuItemOption {
  id: number
  name: string
  price: number
  available: boolean
  stock: number
}

interface MenuCategory {
  id: number
  name: string
  icon: string
  items: MenuItemOption[]
}

export interface EditItem {
  menuItemId: number
  name: string
  quantity: number
  unitPrice: number
}

interface OrderItem {
  id: number
  quantity: number
  unitPrice: number
  menuItem: { id: number; name: string }
}

interface Order {
  id: number
  orderNumber: string
  totalAmount: number
  items: OrderItem[]
}

interface EditOrderDrawerProps {
  order: Order | null
  onClose: () => void
  onSaved: (updatedOrder: Order) => void
}

export function EditOrderDrawer({ order, onClose, onSaved }: EditOrderDrawerProps) {
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!order) return
    setEditItems(order.items.map(i => ({
      menuItemId: i.menuItem.id,
      name: i.menuItem.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })))
    setSaveError('')
    setShowPicker(false)
    setLoadingMenu(true)
    fetch('/api/categories')
      .then(r => r.json())
      .then((data: MenuCategory[]) => {
        setCategories(data)
        if (data.length > 0) setActiveCategory(data[0].id)
        setLoadingMenu(false)
      })
      .catch(() => setLoadingMenu(false))
  }, [order])

  const total = editItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  const updateQty = (idx: number, qty: number) => {
    if (qty <= 0) {
      setEditItems(prev => prev.filter((_, i) => i !== idx))
    } else {
      setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item))
    }
  }

  const addMenuItem = (menuItem: MenuItemOption) => {
    setEditItems(prev => {
      const existing = prev.findIndex(i => i.menuItemId === menuItem.id)
      if (existing >= 0) {
        return prev.map((item, i) => i === existing ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { menuItemId: menuItem.id, name: menuItem.name, quantity: 1, unitPrice: menuItem.price }]
    })
  }

  const handleSave = async () => {
    if (!order || editItems.length === 0) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: editItems, totalAmount: total }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json()
      onSaved(updated)
      setSaving(false)
    } catch {
      setSaveError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  if (!order) return null

  const pickerItems = (categories.find(c => c.id === activeCategory)?.items ?? [])
    .filter(i => i.available && i.stock > 0)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-surface shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 shrink-0">
          <div>
            <h2 className="font-headline font-black text-2xl text-on-surface">Edit Order</h2>
            <p className="text-stone-500 font-medium text-sm">{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container transition-colors">
            <Icon name="close" size={24} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Items</p>

          {editItems.length === 0 && (
            <p className="text-stone-400 font-medium text-sm text-center py-4">No items. Add some below.</p>
          )}

          {editItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-surface-container-low rounded-xl p-3">
              <span className="flex-1 font-bold text-on-surface text-sm">{item.name}</span>
              <span className="text-stone-500 text-sm font-medium">₱{item.unitPrice.toFixed(0)}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => updateQty(idx, item.quantity - 1)}
                  className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Icon name={item.quantity === 1 ? 'delete' : 'remove'} size={14} className="text-on-surface-variant" />
                </button>
                <span className="font-headline font-black text-on-surface w-6 text-center text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQty(idx, item.quantity + 1)}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Icon name="add" size={14} className="text-on-primary" />
                </button>
              </div>
            </div>
          ))}

          {/* Add item picker */}
          <div className="pt-1">
            <button
              onClick={() => setShowPicker(p => !p)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-outline-variant/40 text-stone-500 hover:border-primary hover:text-primary transition-colors font-bold text-sm"
            >
              <Icon name={showPicker ? 'expand_less' : 'add'} size={18} />
              {showPicker ? 'Hide Menu' : 'Add Item'}
            </button>

            {showPicker && (
              <div className="mt-3 bg-surface-container-low rounded-xl overflow-hidden">
                {loadingMenu ? (
                  <div className="p-8 flex items-center justify-center">
                    <Icon name="hourglass_empty" size={24} className="text-primary animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex gap-1 p-2 overflow-x-auto">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategory(cat.id)}
                          className={`shrink-0 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${activeCategory === cat.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-stone-500 hover:text-on-surface'}`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    <div className="p-2 grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                      {pickerItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => addMenuItem(item)}
                          className="text-left p-3 rounded-lg bg-surface-container-lowest hover:bg-primary/5 active:scale-95 transition-all border border-outline-variant/10"
                        >
                          <p className="font-bold text-on-surface text-xs leading-tight">{item.name}</p>
                          <p className="text-primary font-black text-sm mt-1">₱{item.price.toFixed(0)}</p>
                        </button>
                      ))}
                      {pickerItems.length === 0 && (
                        <p className="col-span-2 text-center text-stone-400 text-xs py-4">No available items in this category.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-outline-variant/20 px-6 py-4 bg-surface-container-lowest">
          {saveError && <p className="text-xs text-error font-bold mb-3 text-center">{saveError}</p>}
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium text-stone-500 text-sm">New Total</span>
            <span className="font-headline font-black text-2xl text-primary">₱{total.toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-surface-container-low text-on-surface hover:bg-surface-container active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || editItems.length === 0}
              className="flex-1 py-3.5 rounded-xl font-headline font-bold text-sm bg-secondary text-on-secondary shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
