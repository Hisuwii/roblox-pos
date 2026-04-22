import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Package, PackagePlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

const GAMES = ['Blox Fruit', 'Steal a Brainrot', 'Other']
const MAX_QTY = { 'Blox Fruit': 4 }
const EMPTY_FORM = { name: '', price: '', qty: '', category: 'Blox Fruit', image_url: '' }

const S = {
  card:     { background: '#141422', border: '1px solid #24243c', borderRadius: '1rem' },
  surface:  { background: '#0e0e1a', border: '1px solid #1c1c2e' },
  elevated: { background: '#1c1c2e' },
  input:    { background: '#0e0e1a', border: '1px solid #2e2e4a', color: '#e8e8f0', outline: 'none', borderRadius: '0.75rem', padding: '0.625rem 0.75rem', width: '100%', fontSize: '0.875rem' },
}

export default function ItemCatalog() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [gameFilter, setGameFilter] = useState('All')
  const [restockItem, setRestockItem] = useState(null)
  const [restockAmount, setRestockAmount] = useState('1')

  useEffect(() => {
    fetchItems()
    const ch = supabase.channel('items-catalog').on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchItems).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function fetchItems() {
    const { data, error } = await supabase.from('items').select('*').order('name')
    if (error) toast.error('Failed to load items')
    else setItems(data ?? [])
    setLoading(false)
  }

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true) }
  function openEdit(item) {
    setEditing(item.id)
    setForm({ name: item.name, price: String(item.price), qty: String(item.qty), category: item.category, image_url: item.image_url ?? '' })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name is required')
    const price = parseFloat(form.price)
    const qty = parseInt(form.qty, 10)
    if (isNaN(price) || price < 0) return toast.error('Enter a valid price')
    if (isNaN(qty) || qty < 0) return toast.error('Enter a valid quantity')
    setSaving(true)
    const payload = { name: form.name.trim(), price, qty, category: form.category, image_url: form.image_url.trim() || null }
    const { error } = editing
      ? await supabase.from('items').update(payload).eq('id', editing)
      : await supabase.from('items').insert(payload)
    setSaving(false)
    if (error) return toast.error('Save failed: ' + error.message)
    toast.success(editing ? 'Item updated' : 'Item added')
    setModalOpen(false)
  }

  async function handleRestock() {
    const add = parseInt(restockAmount, 10)
    if (isNaN(add) || add <= 0) return toast.error('Enter a valid amount')
    const max = MAX_QTY[restockItem.category]
    let newQty = restockItem.qty + add
    if (max && newQty > max) {
      toast.error(`Capped at ${max} for ${restockItem.category}`)
      newQty = max
    }
    const { error } = await supabase.from('items').update({ qty: newQty }).eq('id', restockItem.id)
    if (error) return toast.error('Restock failed: ' + error.message)
    toast.success(`+${newQty - restockItem.qty} ${restockItem.name}`)
    setRestockItem(null); setRestockAmount('1')
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) toast.error('Delete failed: ' + error.message)
    else toast.success('Item deleted')
    setDeleteConfirm(null)
  }

  const displayed = items.filter((i) => gameFilter === 'All' || i.category === gameFilter)

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-600">Loading...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white font-bold text-lg">Item Catalog</h2>
          <p className="text-slate-600 text-sm mt-0.5">{items.length} items total</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
        >
          <Plus size={15} /> Add Item
        </button>
      </div>

      {/* Game filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {['All', ...GAMES].map((game) => {
          const active = gameFilter === game
          const count = game === 'All' ? items.length : items.filter((i) => i.category === game).length
          return (
            <button
              key={game}
              onClick={() => setGameFilter(game)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0"
              style={{
                background: active ? '#1c1c2e' : 'transparent',
                border: active ? '1px solid #7c3aed' : '1px solid #24243c',
                color: active ? '#a78bfa' : '#4b5563',
              }}
            >
              {game}
              <span className="ml-2 text-xs" style={{ color: active ? '#6d28d9' : '#2e2e4a' }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {displayed.length === 0 ? (
        <div className="text-center py-24 text-slate-700 flex flex-col items-center gap-3">
          <Package size={44} className="opacity-20" />
          <p>No items here yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {displayed.map((item) => (
            <div
              key={item.id}
              className="flex flex-col rounded-2xl overflow-hidden transition-all"
              style={S.card}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2e2e4a')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#24243c')}
            >
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full aspect-square object-cover" style={{ background: '#0e0e1a' }} onError={(e) => { e.target.style.display = 'none' }} />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center" style={{ background: '#0e0e1a' }}>
                  <Package size={30} className="text-slate-700" />
                </div>
              )}
              <div className="p-3 flex flex-col gap-2 flex-1">
                <div>
                  <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#3d3d60' }}>{item.category}</p>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-violet-400 text-sm font-bold">₱{item.price.toLocaleString()}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    item.qty === 0 ? 'text-red-400 bg-red-900/20' :
                    item.qty <= 1 ? 'text-amber-400 bg-amber-900/20' :
                    'text-slate-500 bg-slate-800/40'
                  }`}>{item.qty} left</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => { setRestockItem(item); setRestockAmount('1') }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors" style={{ background: '#1a1438' }}>
                    <PackagePlus size={11} /> Stock
                  </button>
                  <button onClick={() => openEdit(item)} className="flex items-center justify-center px-2 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors" style={{ background: '#1c1c2e' }} title="Edit">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => setDeleteConfirm(item)} className="flex items-center justify-center px-2 py-1.5 rounded-lg text-red-500 hover:text-red-300 transition-colors" style={{ background: '#1c0a0a' }} title="Delete">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <Overlay onClose={() => setModalOpen(false)}>
          <h3 className="text-white font-bold text-lg mb-5">{editing ? 'Edit Item' : 'New Item'}</h3>
          <div className="flex flex-col gap-4">
            <Field label="Game">
              <select className="input-base" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, qty: '' })} style={{ background: '#0e0e1a', border: '1px solid #2e2e4a', color: '#e8e8f0', borderRadius: '0.75rem', padding: '0.625rem 0.75rem', width: '100%', fontSize: '0.875rem', outline: 'none' }}>
                {GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Item Name *">
              <input style={S.input} placeholder="e.g. Leopard Fruit" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onFocus={(e) => (e.target.style.borderColor = '#7c3aed')} onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (₱) *">
                <input type="number" min="0" style={S.input} placeholder="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} onFocus={(e) => (e.target.style.borderColor = '#7c3aed')} onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')} />
              </Field>
              <Field label={`Stock${MAX_QTY[form.category] ? ` (max ${MAX_QTY[form.category]})` : ''} *`}>
                <input type="number" min="0" max={MAX_QTY[form.category] ?? undefined} style={S.input} placeholder={MAX_QTY[form.category] ? `1–${MAX_QTY[form.category]}` : '0'}
                  value={form.qty}
                  onChange={(e) => {
                    const max = MAX_QTY[form.category]
                    setForm({ ...form, qty: max ? String(Math.min(parseInt(e.target.value) || 0, max)) : e.target.value })
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                  onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')}
                />
              </Field>
            </div>
            <Field label="Image URL (optional)">
              <input style={S.input} placeholder="https://..." value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} onFocus={(e) => (e.target.style.borderColor = '#7c3aed')} onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')} />
            </Field>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors" style={{ background: '#1c1c2e' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Item'}
            </button>
          </div>
        </Overlay>
      )}

      {/* Restock Modal */}
      {restockItem && (
        <Overlay onClose={() => setRestockItem(null)} small>
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#1a1438' }}>
              <PackagePlus size={20} className="text-violet-400" />
            </div>
            <h3 className="text-white font-bold mb-1">Restock {restockItem.name}</h3>
            <p className="text-slate-500 text-sm mb-5">
              Current: <span className="text-white font-semibold">{restockItem.qty}</span>
              {MAX_QTY[restockItem.category] && <span className="text-slate-600"> / max {MAX_QTY[restockItem.category]}</span>}
            </p>
            <div className="text-left">
              <label className="text-slate-500 text-xs font-medium block mb-1.5">Add how many?</label>
              <input
                type="number" min="1" autoFocus
                style={S.input}
                value={restockAmount}
                onChange={(e) => setRestockAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRestock()}
                onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRestockItem(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300" style={{ background: '#1c1c2e' }}>Cancel</button>
              <button onClick={handleRestock} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>Add Stock</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Delete Modal */}
      {deleteConfirm && (
        <Overlay onClose={() => setDeleteConfirm(null)} small>
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#1c0a0a' }}>
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-white font-bold mb-1">Delete item?</h3>
            <p className="text-slate-500 text-sm mb-6">"{deleteConfirm.name}" will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300" style={{ background: '#1c1c2e' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#991b1b' }}>Delete</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-slate-500 text-xs font-medium block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Overlay({ children, onClose, small }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full rounded-2xl p-6 shadow-2xl" style={{ background: '#141422', border: '1px solid #24243c', maxWidth: small ? '24rem' : '28rem' }}>
        {children}
      </div>
    </div>
  )
}
