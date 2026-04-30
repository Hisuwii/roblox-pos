import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Search, ShoppingCart, Package, X, Trash2, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'

const S = {
  card:         { background: '#141422', border: '1px solid #24243c' },
  cardSelected: { background: '#1c1c2e', border: '2px solid #8b5cf6', boxShadow: '0 0 20px #7c3aed28' },
  cardOTO:      { background: '#160e00', border: '1px solid #92400e' },
  cardOTOSel:   { background: '#1c1200', border: '2px solid #d97706', boxShadow: '0 0 20px #d9770628' },
  input:        { background: '#0e0e1a', border: '1px solid #2e2e4a', color: '#e8e8f0', outline: 'none', borderRadius: '0.5rem', padding: '0.375rem 0.5rem', width: '100%', fontSize: '0.8125rem' },
  surface:      { background: '#0e0e1a', border: '1px solid #1c1c2e' },
  elevated:     { background: '#1c1c2e' },
}

export default function POSScreen() {
  const [items, setItems] = useState([])
  const [recentTx, setRecentTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState([])           // [{id, name, category, qty, price, maxQty, isOneTime}]
  const [notes, setNotes] = useState('')
  const [selling, setSelling] = useState(false)
  const [search, setSearch] = useState('')
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

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

  function addToCart(item) {
    if (item.qty === 0) return
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) {
        if (existing.qty >= item.qty) {
          toast.error(`Only ${item.qty} ${item.name} in stock`, { id: `stock-${item.id}` })
          return prev
        }
        return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, {
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        qty: 1,
        maxQty: item.qty,
        isOneTime: item.is_one_time ?? false,
      }]
    })
  }

  function updateLine(id, field, value) {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c))
  }

  function removeLine(id) {
    setCart((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleRecordSale() {
    if (cart.length === 0) return toast.error('Cart is empty')

    for (const c of cart) {
      const q = parseInt(c.qty); const p = parseFloat(c.price)
      if (isNaN(q) || q < 1)            return toast.error(`${c.name}: invalid quantity`)
      if (q > c.maxQty)                 return toast.error(`${c.name}: only ${c.maxQty} in stock`)
      if (isNaN(p) || p < 0)            return toast.error(`${c.name}: invalid price`)
    }

    setSelling(true)
    const now = new Date().toISOString()
    const inserts = cart.map((c) => ({
      item_id: c.id,
      qty_sold: parseInt(c.qty),
      total: parseFloat(c.price) * parseInt(c.qty),
      notes: notes.trim() || null,
      date: now,
    }))

    const { error: txErr } = await supabase.from('transactions').insert(inserts)
    if (txErr) { setSelling(false); return toast.error('Sale failed: ' + txErr.message) }

    // Regular items: decrement stock. One-time items: delete entirely.
    const regularItems = cart.filter((c) => !c.isOneTime)
    const oneTimeItems  = cart.filter((c) => c.isOneTime)

    await Promise.all([
      ...regularItems.map((c) =>
        supabase.from('items').update({ qty: c.maxQty - parseInt(c.qty) }).eq('id', c.id)
      ),
      ...oneTimeItems.map((c) =>
        supabase.from('items').delete().eq('id', c.id)
      ),
    ])

    setSelling(false)
    const grand = inserts.reduce((s, i) => s + i.total, 0)
    toast.success(`${cart.length} sale${cart.length > 1 ? 's' : ''} recorded — ₱${grand.toLocaleString()}`)
    setCart([]); setNotes(''); setMobileCartOpen(false)
  }

  const filtered = items
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.qty > 0) - (a.qty > 0))
  const grandTotal = cart.reduce((s, c) => s + (parseFloat(c.price) || 0) * (parseInt(c.qty) || 0), 0)
  const cartCount = cart.reduce((s, c) => s + (parseInt(c.qty) || 0), 0)

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-600">Loading...</div>

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* Item grid */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              style={{ background: '#0e0e1a', border: '1px solid #2e2e4a', color: '#e8e8f0', outline: 'none', borderRadius: '0.75rem', padding: '0.625rem 0.75rem 0.625rem 2.25rem', width: '100%', fontSize: '0.875rem' }}
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
              onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-700 flex flex-col items-center gap-3">
              <Package size={36} className="opacity-20" />
              <p className="text-sm">No items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((item) => {
                const out = item.qty === 0
                const inCart = cart.find((c) => c.id === item.id)
                const isOTO = item.is_one_time ?? false

                let cardStyle
                if (out) {
                  cardStyle = { ...S.card, opacity: 0.3, cursor: 'not-allowed' }
                } else if (inCart) {
                  cardStyle = isOTO ? S.cardOTOSel : S.cardSelected
                } else {
                  cardStyle = isOTO ? S.cardOTO : S.card
                }

                return (
                  <button
                    key={item.id}
                    disabled={out}
                    onClick={() => addToCart(item)}
                    className="relative text-left rounded-2xl transition-all duration-150"
                    style={cardStyle}
                    onMouseEnter={(e) => {
                      if (!out && !inCart) Object.assign(e.currentTarget.style, isOTO
                        ? { background: '#1c1200', borderColor: '#d97706' }
                        : { background: '#1c1c2e', borderColor: '#3d3d60' })
                    }}
                    onMouseLeave={(e) => {
                      if (!out && !inCart) Object.assign(e.currentTarget.style, isOTO
                        ? { background: '#160e00', borderColor: '#92400e' }
                        : { background: '#141422', borderColor: '#24243c' })
                    }}
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full aspect-square object-cover rounded-t-2xl" style={{ background: '#0e0e1a' }} onError={(e) => { e.target.style.display = 'none' }} />
                    ) : (
                      <div className="w-full aspect-square rounded-t-2xl flex items-center justify-center" style={{ background: '#0e0e1a' }}>
                        <Package size={28} className="text-slate-700" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-white text-xs font-semibold truncate">{item.name}</p>
                      <p className="text-violet-400 text-sm font-bold mt-0.5">₱{item.price.toLocaleString()}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        {isOTO ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: '#fbbf24' }}>
                            <Star size={9} /> 1× Only
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: '#3d3d60' }}>{item.category}</span>
                        )}
                        <span className={`text-xs font-medium ${item.qty <= 1 ? 'text-amber-400' : 'text-slate-600'}`}>{item.qty} left</span>
                      </div>
                    </div>
                    {inCart && (
                      <div className="absolute top-2 right-2 min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center" style={{ background: isOTO ? '#d97706' : '#7c3aed' }}>
                        <span className="text-white text-[10px] font-bold">{inCart.qty}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right cart panel — desktop */}
        <div className="hidden lg:flex w-80 flex-shrink-0 flex-col gap-3">
          <CartPanel
            cart={cart}
            notes={notes}
            setNotes={setNotes}
            selling={selling}
            grandTotal={grandTotal}
            onUpdate={updateLine}
            onRemove={removeLine}
            onClear={() => setCart([])}
            onRecord={handleRecordSale}
          />

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
                  <p className="text-xs mt-0.5" style={{ color: '#3d3d60' }}>{tx.qty_sold}× · {fmtTime(tx.date)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile floating cart button */}
      {cart.length > 0 && !mobileCartOpen && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full text-white font-semibold text-sm shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', boxShadow: '0 8px 24px #7c3aed40' }}
        >
          <ShoppingCart size={16} /> Cart ({cartCount}) · ₱{grandTotal.toLocaleString()}
        </button>
      )}

      {/* Mobile cart sheet */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} onClick={(e) => e.target === e.currentTarget && setMobileCartOpen(false)}>
          <div className="rounded-t-3xl p-4 pb-6 max-h-[85vh] overflow-auto" style={{ background: '#141422', border: '1px solid #24243c' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold flex items-center gap-2"><ShoppingCart size={16} className="text-violet-400" /> Cart</h3>
              <button onClick={() => setMobileCartOpen(false)} className="text-slate-500"><X size={20} /></button>
            </div>
            <CartPanel
              cart={cart}
              notes={notes}
              setNotes={setNotes}
              selling={selling}
              grandTotal={grandTotal}
              onUpdate={updateLine}
              onRemove={removeLine}
              onClear={() => setCart([])}
              onRecord={handleRecordSale}
              embedded
            />
          </div>
        </div>
      )}
    </>
  )
}

function CartPanel({ cart, notes, setNotes, selling, grandTotal, onUpdate, onRemove, onClear, onRecord, embedded }) {
  const Sx = {
    card:    { background: embedded ? 'transparent' : '#141422', border: embedded ? 'none' : '1px solid #24243c' },
    input:   { background: '#0e0e1a', border: '1px solid #2e2e4a', color: '#e8e8f0', outline: 'none', borderRadius: '0.5rem', padding: '0.375rem 0.5rem', width: '100%', fontSize: '0.8125rem' },
    surface: { background: '#0e0e1a', border: '1px solid #1c1c2e' },
    elevated:{ background: '#1c1c2e' },
  }
  return (
    <div className="rounded-2xl flex flex-col overflow-hidden" style={Sx.card}>
      {!embedded && (
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1c1c2e' }}>
          <span className="text-white font-semibold text-sm flex items-center gap-2">
            <ShoppingCart size={14} className="text-violet-400" /> Cart
            {cart.length > 0 && <span className="text-violet-400 text-xs">({cart.length})</span>}
          </span>
          {cart.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-300 hover:text-white transition-all"
              style={{ background: '#3a0a0a', border: '1px solid #7f1d1d' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#991b1b')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#3a0a0a')}
            >
              <Trash2 size={11} /> Clear
            </button>
          )}
        </div>
      )}

      <div className="p-4 flex flex-col gap-3">
        {cart.length === 0 ? (
          <div className="text-center py-8 flex flex-col items-center gap-2">
            <ShoppingCart size={28} className="text-slate-700" />
            <p className="text-slate-600 text-sm">Tap items to add them</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 max-h-72 overflow-auto">
              {cart.map((c) => {
                const lineTotal = (parseFloat(c.price) || 0) * (parseInt(c.qty) || 0)
                return (
                  <div key={c.id} className="rounded-xl p-2.5" style={c.isOneTime ? { background: '#160e00', border: '1px solid #92400e' } : Sx.elevated}>
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {c.isOneTime && <Star size={10} className="text-amber-400 flex-shrink-0" />}
                        <p className="text-white text-xs font-semibold truncate">{c.name}</p>
                      </div>
                      <button
                        onClick={() => onRemove(c.id)}
                        className="flex items-center justify-center w-6 h-6 rounded-md text-red-300 hover:text-white transition-all flex-shrink-0"
                        style={{ background: '#3a0a0a', border: '1px solid #7f1d1d' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#991b1b')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#3a0a0a')}
                        title="Remove from cart"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-[60px_1fr_auto] gap-1.5 items-center">
                      {c.isOneTime ? (
                        <div className="flex items-center justify-center rounded-lg text-xs font-bold" style={{ background: '#1c1200', border: '1px solid #92400e', color: '#fbbf24', padding: '0.375rem 0.5rem' }}>
                          1
                        </div>
                      ) : (
                        <input
                          type="number" min="1" max={c.maxQty}
                          style={{ ...Sx.input, textAlign: 'center' }}
                          value={c.qty}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(c.maxQty, parseInt(e.target.value) || 1))
                            onUpdate(c.id, 'qty', v)
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                          onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')}
                        />
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-slate-600 text-xs">₱</span>
                        <input
                          type="number" min="0"
                          style={Sx.input}
                          value={c.price}
                          onChange={(e) => onUpdate(c.id, 'price', e.target.value)}
                          onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                          onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')}
                        />
                      </div>
                      <span className="text-violet-400 text-sm font-bold whitespace-nowrap">₱{lineTotal.toLocaleString()}</span>
                    </div>
                    {c.isOneTime ? (
                      <p className="text-[10px] mt-1" style={{ color: '#92400e' }}>One-time offer · will be removed after sale</p>
                    ) : (
                      <p className="text-[10px] mt-1" style={{ color: '#3d3d60' }}>{c.maxQty} in stock · default ₱{c.price.toLocaleString?.() ?? c.price}</p>
                    )}
                  </div>
                )
              })}
            </div>

            <div>
              <label className="text-slate-500 text-xs font-medium block mb-1.5">Buyer / Notes</label>
              <input
                style={{ background: '#0e0e1a', border: '1px solid #2e2e4a', color: '#e8e8f0', outline: 'none', borderRadius: '0.75rem', padding: '0.5rem 0.75rem', width: '100%', fontSize: '0.8125rem' }}
                placeholder="optional..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')}
              />
            </div>

            <div className="rounded-xl p-3 flex items-center justify-between" style={Sx.surface}>
              <span className="text-slate-400 text-sm">Total</span>
              <span className="text-violet-300 text-xl font-bold">₱{grandTotal.toLocaleString()}</span>
            </div>

            <button
              onClick={onRecord}
              disabled={selling}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-40"
              style={{ background: selling ? '#5b21b6' : 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
            >
              {selling ? 'Recording...' : `✓  Record ${cart.length} Sale${cart.length > 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function fmtTime(d) {
  const date = new Date(d)
  return date.toLocaleString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
