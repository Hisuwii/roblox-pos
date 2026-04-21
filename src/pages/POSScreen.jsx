import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Search, Minus, Plus, ShoppingCart, Package, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const S = {
  card:         { background: '#141422', border: '1px solid #24243c' },
  cardHover:    { background: '#1c1c2e', border: '1px solid #2e2e4a' },
  cardSelected: { background: '#1c1c2e', border: '2px solid #8b5cf6', boxShadow: '0 0 20px #7c3aed28' },
  input:        { background: '#0e0e1a', border: '1px solid #2e2e4a', color: '#e8e8f0', outline: 'none', borderRadius: '0.75rem', padding: '0.625rem 0.75rem', width: '100%', fontSize: '0.875rem' },
  surface:      { background: '#0e0e1a', border: '1px solid #1c1c2e' },
  elevated:     { background: '#1c1c2e' },
}

export default function POSScreen() {
  const [items, setItems] = useState([])
  const [recentTx, setRecentTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [selling, setSelling] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchData()
    const a = supabase.channel('pos-items').on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchData).subscribe()
    const b = supabase.channel('pos-tx').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, fetchData).subscribe()
    return () => { supabase.removeChannel(a); supabase.removeChannel(b) }
  }, [])

  async function fetchData() {
    const [ir, tr] = await Promise.all([
      supabase.from('items').select('*').order('name'),
      supabase.from('transactions').select('*, items(name)').order('date', { ascending: false }).limit(8),
    ])
    if (!ir.error) setItems(ir.data ?? [])
    if (!tr.error) setRecentTx(tr.data ?? [])
    setLoading(false)
  }

  async function handleSell() {
    if (!selected) return toast.error('Select an item first')
    if (qty < 1) return toast.error('Quantity must be at least 1')
    if (qty > selected.qty) return toast.error(`Only ${selected.qty} in stock`)
    setSelling(true)
    const total = selected.price * qty
    const { error: te } = await supabase.from('transactions').insert({ item_id: selected.id, qty_sold: qty, total, notes: notes.trim() || null, date: new Date().toISOString() })
    if (te) { setSelling(false); return toast.error('Sale failed: ' + te.message) }
    const { error: se } = await supabase.from('items').update({ qty: selected.qty - qty }).eq('id', selected.id)
    setSelling(false)
    if (se) return toast.error('Stock update failed')
    toast.success(`Sold ${qty}× ${selected.name} — ₱${total.toLocaleString()}`)
    setSelected(null); setQty(1); setNotes('')
  }

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-600">Loading...</div>

  return (
    <div className="flex gap-4 h-full">
      {/* Grid */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            style={{ ...S.input, paddingLeft: '2.25rem' }}
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
            onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-700 flex flex-col items-center gap-3">
            <Package size={40} className="opacity-20" />
            <p className="text-sm">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((item) => {
              const outOfStock = item.qty === 0
              const isSel = selected?.id === item.id
              return (
                <button
                  key={item.id}
                  disabled={outOfStock}
                  onClick={() => { setSelected(isSel ? null : item); setQty(1) }}
                  className="relative text-left rounded-2xl transition-all duration-150"
                  style={outOfStock ? { ...S.card, opacity: 0.3, cursor: 'not-allowed' } : isSel ? S.cardSelected : S.card}
                  onMouseEnter={(e) => { if (!outOfStock && !isSel) Object.assign(e.currentTarget.style, { background: '#1c1c2e', borderColor: '#3d3d60' }) }}
                  onMouseLeave={(e) => { if (!outOfStock && !isSel) Object.assign(e.currentTarget.style, { background: '#141422', borderColor: '#24243c' }) }}
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full aspect-square object-cover rounded-t-2xl" style={{ background: '#0e0e1a' }} onError={(e) => { e.target.style.display = 'none' }} />
                  ) : (
                    <div className="w-full aspect-square rounded-t-2xl flex items-center justify-center" style={{ background: '#0e0e1a' }}>
                      <Package size={32} className="text-slate-700" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-violet-400 text-sm font-bold mt-0.5">₱{item.price.toLocaleString()}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs" style={{ color: '#3d3d60' }}>{item.category}</span>
                      <span className={`text-xs font-medium ${item.qty <= 1 ? 'text-amber-400' : 'text-slate-500'}`}>{item.qty} left</span>
                    </div>
                  </div>
                  {isSel && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-[9px] font-bold">✓</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div className="w-68 flex-shrink-0 flex flex-col gap-3" style={{ width: '17rem' }}>
        {/* Sell */}
        <div className="rounded-2xl overflow-hidden flex flex-col" style={S.card}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1c1c2e' }}>
            <span className="text-white font-semibold text-sm flex items-center gap-2">
              <ShoppingCart size={14} className="text-violet-400" /> Sell
            </span>
            {selected && <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-300 transition-colors"><X size={14} /></button>}
          </div>

          <div className="p-4">
            {selected ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-xl p-3" style={S.elevated}>
                  <p className="text-white text-sm font-semibold">{selected.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{selected.category}</p>
                  <p className="text-violet-400 font-bold text-sm mt-1.5">₱{selected.price.toLocaleString()} each</p>
                </div>

                <div>
                  <label className="text-slate-500 text-xs font-medium block mb-2">Quantity</label>
                  <div className="flex items-center rounded-xl overflow-hidden" style={{ background: '#0e0e1a', border: '1px solid #2e2e4a' }}>
                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-white hover:bg-violet-500/10 transition-colors">
                      <Minus size={14} />
                    </button>
                    <input
                      type="number" min="1" max={selected.qty} value={qty}
                      onChange={(e) => setQty(Math.max(1, Math.min(selected.qty, parseInt(e.target.value) || 1)))}
                      className="flex-1 text-center text-white text-lg font-bold py-2"
                      style={{ background: 'transparent', border: 'none', outline: 'none' }}
                    />
                    <button onClick={() => setQty(Math.min(selected.qty, qty + 1))} className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-white hover:bg-violet-500/10 transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="text-center text-xs text-slate-700 mt-1.5">{selected.qty} available</p>
                </div>

                <div>
                  <label className="text-slate-500 text-xs font-medium block mb-1.5">Buyer / Notes</label>
                  <input
                    style={S.input}
                    placeholder="optional..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                    onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')}
                  />
                </div>

                <div className="rounded-xl p-3 flex items-center justify-between" style={S.surface}>
                  <span className="text-slate-400 text-sm">Total</span>
                  <span className="text-violet-300 text-xl font-bold">₱{(selected.price * qty).toLocaleString()}</span>
                </div>

                <button
                  onClick={handleSell}
                  disabled={selling}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40"
                  style={{ background: selling ? '#5b21b6' : 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
                >
                  {selling ? 'Recording...' : '✓  Record Sale'}
                </button>
              </div>
            ) : (
              <div className="text-center py-8 flex flex-col items-center gap-2">
                <ShoppingCart size={28} className="text-slate-700" />
                <p className="text-slate-600 text-sm">Tap an item to sell it</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="rounded-2xl flex-1 flex flex-col overflow-hidden" style={S.card}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #1c1c2e' }}>
            <h3 className="text-white font-semibold text-sm">Recent Sales</h3>
          </div>
          <div className="p-3 flex-1 overflow-auto flex flex-col gap-2">
            {recentTx.length === 0 ? (
              <p className="text-slate-700 text-sm text-center py-6">No sales yet</p>
            ) : recentTx.map((tx) => (
              <div key={tx.id} className="rounded-xl px-3 py-2.5" style={S.elevated}>
                <div className="flex justify-between items-start gap-2">
                  <p className="text-white text-xs font-medium truncate">{tx.items?.name ?? 'Unknown'}</p>
                  <span className="text-violet-400 text-xs font-bold flex-shrink-0">+₱{tx.total.toLocaleString()}</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#3d3d60' }}>
                  {tx.qty_sold}× · {new Date(tx.date).toLocaleDateString()}{tx.notes ? ` · ${tx.notes}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
