'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/shared/Icon'
import { DrawerPanel } from '@/components/admin/DrawerPanel'

interface Category { id: number; name: string; icon: string; sortOrder: number; active: boolean; items: MenuItem[] }
interface MenuItem { id: number; name: string; categoryId: number; price: number; description: string; image: string; stock: number; available: boolean; categoryName?: string }

type Tab = 'items' | 'categories'

const EMPTY_ITEM = { name: '', categoryId: 0, price: '', description: '', image: '', stock: '999', available: true }
const EMPTY_CAT = { name: '', icon: 'restaurant', sortOrder: 0 }

const COMMON_ICONS = [
  'restaurant', 'lunch_dining', 'bakery_dining', 'local_pizza', 'fastfood',
  'ramen_dining', 'icecream', 'cake', 'local_cafe', 'local_drink', 'liquor',
  'egg_alt', 'kebab_dining', 'cookie', 'set_meal', 'coffee'
]

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>('items')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<number | 'all'>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [catForm, setCatForm] = useState(EMPTY_CAT)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    fetch('/api/categories?all=true')
      .then(r => r.json())
      .then((data: Category[]) => { setCategories(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const allItems = categories.flatMap(c => c.items.map(i => ({ ...i, categoryName: c.name })))

  const filteredItems = allItems.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || i.categoryId === filterCat
    return matchSearch && matchCat
  })

  const totalItems = allItems.length
  const lowStock = allItems.filter(i => i.stock > 0 && i.stock <= 5).length
  const outOfStock = allItems.filter(i => i.stock === 0).length

  const openAddItem = () => {
    setEditingItem(null)
    setItemForm({ ...EMPTY_ITEM, categoryId: categories[0]?.id ?? 0 })
    setDrawerOpen(true)
  }

  const openEditItem = (item: MenuItem & { categoryName?: string }) => {
    setEditingItem(item)
    setItemForm({ name: item.name, categoryId: item.categoryId, price: String(item.price), description: item.description, image: item.image, stock: String(item.stock), available: item.available })
    setDrawerOpen(true)
  }

  const openAddCat = () => {
    setEditingCat(null)
    setCatForm(EMPTY_CAT)
    setDrawerOpen(true)
  }

  const openEditCat = (cat: Category) => {
    setEditingCat(cat)
    setCatForm({ name: cat.name, icon: cat.icon, sortOrder: cat.sortOrder })
    setDrawerOpen(true)
  }

  const closeDrawer = () => { setDrawerOpen(false); setEditingItem(null); setEditingCat(null) }

  const handleUpload = async (file: File) => {
    setUploadError('')
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image too large. Max 5 MB.')
      return
    }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (data.url) {
      setItemForm(f => ({ ...f, image: data.url }))
    } else {
      setUploadError(data.error ?? 'Upload failed.')
    }
  }

  const saveItem = async () => {
    setSaving(true)
    const body = { ...itemForm, categoryId: Number(itemForm.categoryId), price: parseFloat(itemForm.price), stock: parseInt(itemForm.stock) }
    if (editingItem) {
      await fetch(`/api/menu-items/${editingItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/menu-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false)
    closeDrawer()
    load()
  }

  const deleteItem = async (id: number) => {
    if (!confirm('Delete this item?')) return
    await fetch(`/api/menu-items/${id}`, { method: 'DELETE' })
    load()
  }

  const toggleItemAvailable = async (item: MenuItem) => {
    await fetch(`/api/menu-items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: !item.available }) })
    load()
  }

  const saveCat = async () => {
    setSaving(true)
    if (editingCat) {
      await fetch(`/api/categories/${editingCat.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) })
    } else {
      await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) })
    }
    setSaving(false)
    closeDrawer()
    load()
  }

  const deleteCat = async (id: number) => {
    if (!confirm('Delete this category? All its items will be deleted too.')) return
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    load()
  }

  const toggleCatActive = async (cat: Category) => {
    await fetch(`/api/categories/${cat.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !cat.active }) })
    load()
  }

  const stockColor = (stock: number) => {
    if (stock === 0) return 'text-on-surface-variant'
    if (stock <= 5) return 'text-primary'
    return 'text-tertiary'
  }

  const stockBarWidth = (stock: number) => {
    if (stock === 0) return '0%'
    if (stock >= 100) return '100%'
    return `${stock}%`
  }

  if (loading && categories.length === 0) return (
    <div className="flex items-center justify-center h-full p-8">
      <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
    </div>
  )

  const isItemTab = tab === 'items'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">Inventory Management</h2>
          <p className="text-stone-500 font-body mt-2">Manage your canteen food items, pricing, and stock levels.</p>
        </div>
        <button
          onClick={isItemTab ? openAddItem : openAddCat}
          className="flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-xl font-headline font-bold text-lg shadow-xl shadow-primary/20 active:scale-95 transition-transform"
        >
          <Icon name="add" size={20} />
          {isItemTab ? 'Add New Item' : 'Add Category'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-container rounded-xl w-fit mb-6">
        {(['items', 'categories'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg font-headline font-bold text-sm transition-all ${tab === t ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {t === 'items' ? 'Menu Items' : 'Categories'}
          </button>
        ))}
      </div>

      {/* Items tab */}
      {tab === 'items' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: 'Total Items', value: totalItems, icon: 'trending_up', color: 'text-on-surface', desc: 'Overall catalog' },
              { label: 'Low Stock Alerts', value: lowStock, icon: 'warning', color: 'text-primary', desc: 'Requires attention' },
              { label: 'Out of Stock', value: outOfStock, icon: 'check_circle', color: 'text-on-surface-variant', desc: 'Updated 5m ago' },
            ].map(s => (
              <div key={s.label} className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
                <p className="text-stone-500 text-sm font-medium">{s.label}</p>
                <p className={`font-headline font-bold text-3xl mt-1 ${s.color}`}>{s.value}</p>
                <div className={`mt-4 flex items-center text-xs font-bold ${s.color}`}>
                  <Icon name={s.icon} size={16} className="mr-1" />
                  {s.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Table container */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="relative flex-1 max-w-md">
                  <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search inventory..."
                    className="w-full bg-surface-container-low border-none rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary/20 text-sm"
                  />
                </div>
                <select
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-surface-container-low rounded-full px-4 py-2 text-sm font-bold text-on-surface-variant appearance-none outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">Filter: All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Item Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Stock Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Available</th>
                    <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-surface-container overflow-hidden shrink-0 flex items-center justify-center">
                            {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Icon name="restaurant" size={20} className="text-outline" />}
                          </div>
                          <div>
                            <p className="font-bold text-on-surface text-sm">{item.name}</p>
                            <p className="text-xs text-stone-400">SKU: HB-{(item.categoryName ?? '').substring(0,3).toUpperCase()}-{String(item.id).padStart(3,'0')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-surface-container-highest/30 text-on-surface-variant text-[10px] font-bold rounded-full uppercase">
                          {item.categoryName}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-headline font-bold text-on-surface">
                        ₱{item.price.toFixed(0)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 bg-stone-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${item.stock === 0 ? 'bg-stone-300' : item.stock <= 5 ? 'bg-primary' : 'bg-tertiary'}`} style={{ width: stockBarWidth(item.stock) }} />
                          </div>
                          <span className={`text-xs font-bold ${item.stock === 0 ? 'text-stone-400 italic' : stockColor(item.stock)}`}>
                            {item.stock === 0 ? 'Out of Stock' : item.stock <= 5 ? `Low Stock (${item.stock})` : `In Stock (${item.stock})`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleItemAvailable(item)}
                          className={`w-10 h-6 rounded-full transition-colors relative ${item.available ? 'bg-tertiary' : 'bg-stone-300'}`}
                        >
                          <span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white transition-transform ${item.available ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditItem(item)} className="p-2 text-stone-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                            <Icon name="edit" size={18} />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="p-2 text-stone-400 hover:text-error hover:bg-error/10 rounded-lg transition-all">
                            <Icon name="delete" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-stone-500 font-medium">No items found matching the current filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Categories tab */}
      {tab === 'categories' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
           <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-headline font-bold text-on-surface">Categories</h3>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Icon</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Active</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {categories.map(cat => (
                  <tr key={cat.id} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-on-surface">{cat.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-stone-500">
                        <Icon name={cat.icon} size={20} />
                        <span className="text-xs">{cat.icon}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-stone-500 text-sm font-medium">{cat.items.length} items</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleCatActive(cat)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${cat.active ? 'bg-tertiary' : 'bg-stone-300'}`}
                      >
                        <span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white transition-transform ${cat.active ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditCat(cat)} className="p-2 text-stone-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                          <Icon name="edit" size={18} />
                        </button>
                        <button onClick={() => deleteCat(cat.id)} className="p-2 text-stone-400 hover:text-error hover:bg-error/10 rounded-lg transition-all">
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer */}
      <DrawerPanel
        open={drawerOpen}
        onClose={closeDrawer}
        title={isItemTab ? (editingItem ? 'Edit Item' : 'Add New Item') : (editingCat ? 'Edit Category' : 'Add Category')}
      >
        {tab === 'items' && (
          <div className="flex flex-col gap-6 pt-2">
            {/* Image upload */}
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">Item Image</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full h-40 bg-surface-container-lowest border border-dashed border-outline-variant/50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-low transition-colors overflow-hidden relative shadow-sm"
              >
                {itemForm.image ? (
                  <img src={itemForm.image} alt="preview" className="w-full h-full object-cover" />
                ) : uploading ? (
                  <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
                ) : (
                  <>
                    <Icon name="upload" size={32} className="text-stone-400" />
                    <span className="text-xs text-stone-500 mt-2 font-medium">Click to upload JPG / PNG</span>
                  </>
                )}
                {itemForm.image && (
                  <button
                    onClick={e => { e.stopPropagation(); setItemForm(f => ({ ...f, image: '' })) }}
                    className="absolute top-3 right-3 w-8 h-8 bg-surface/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm"
                  >
                    <Icon name="close" size={18} className="text-on-surface" />
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
              {uploadError && (
                <p className="text-xs text-error font-bold mt-1">{uploadError}</p>
              )}
            </div>

            {[
              { label: 'Name', key: 'name', type: 'text', placeholder: 'e.g. Classic Deluxe Burger' },
              { label: 'Price (₱)', key: 'price', type: 'number', placeholder: '0.00' },
              { label: 'Stock Level', key: 'stock', type: 'number', placeholder: '999' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-sm font-bold text-on-surface-variant mb-2 block">{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={itemForm[field.key as keyof typeof itemForm] as string}
                  onChange={e => setItemForm(f => ({ ...f, [field.key]: e.target.value }))}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ))}

            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">Category</label>
              <select
                value={itemForm.categoryId}
                onChange={e => setItemForm(f => ({ ...f, categoryId: Number(e.target.value) }))}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">Description</label>
              <textarea
                rows={3}
                placeholder="Short description of the item..."
                value={itemForm.description}
                onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex items-center justify-between mt-2 pt-4 border-t border-surface-container">
              <div>
                <span className="text-sm font-bold text-on-surface block">Available on menu</span>
                <span className="text-xs text-stone-500">Allow customers to order this item</span>
              </div>
              <button
                onClick={() => setItemForm(f => ({ ...f, available: !f.available }))}
                className={`w-12 h-7 rounded-full transition-colors relative ${itemForm.available ? 'bg-tertiary' : 'bg-stone-300'}`}
              >
                <span className={`absolute left-0 top-1 w-5 h-5 rounded-full bg-white transition-transform shadow ${itemForm.available ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <button
              onClick={saveItem}
              disabled={saving || !itemForm.name || !itemForm.price}
              className="w-full bg-primary text-on-primary py-4 rounded-xl font-headline font-bold disabled:opacity-50 active:scale-95 transition-transform mt-4 shadow-lg shadow-primary/20"
            >
              {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        )}

        {tab === 'categories' && (
          <div className="flex flex-col gap-6 pt-2">
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">Name</label>
              <input
                type="text"
                placeholder="e.g. Main Course"
                value={catForm.name}
                onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">Icon (Material Symbol name)</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="e.g. restaurant"
                  value={catForm.icon}
                  onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                  className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Icon name={catForm.icon || 'restaurant'} size={24} className="text-primary" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-bold text-on-surface-variant mb-2">Or select from popular icons:</p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_ICONS.map(i => (
                    <button
                      key={i}
                      onClick={() => setCatForm(f => ({ ...f, icon: i }))}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors border ${catForm.icon === i ? 'bg-primary text-on-primary border-primary shadow-md' : 'bg-surface-container-lowest text-stone-500 hover:bg-surface-container border-outline-variant/30'}`}
                      title={i}
                    >
                      <Icon name={i} size={20} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">Sort Order</label>
              <input
                type="number"
                value={catForm.sortOrder}
                onChange={e => setCatForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={saveCat}
              disabled={saving || !catForm.name}
              className="w-full bg-primary text-on-primary py-4 rounded-xl font-headline font-bold disabled:opacity-50 active:scale-95 transition-transform mt-4 shadow-lg shadow-primary/20"
            >
              {saving ? 'Saving…' : editingCat ? 'Save Changes' : 'Add Category'}
            </button>
          </div>
        )}
      </DrawerPanel>
    </div>
  )
}
