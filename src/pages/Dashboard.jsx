import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { TrendingUp, TrendingDown, Wallet, Plus, Trash2, Receipt, CreditCard, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'

const EMPTY_EXPENSE = { amount: '', reason: '', date: new Date().toISOString().slice(0, 10) }

const S = {
  card:    { background: '#141422', border: '1px solid #24243c' },
  surface: { background: '#0e0e1a', border: '1px solid #1c1c2e' },
  input:   { background: '#0e0e1a', border: '1px solid #2e2e4a', color: '#e8e8f0', outline: 'none', borderRadius: '0.75rem', padding: '0.625rem 0.75rem', width: '100%', fontSize: '0.875rem' },
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expenseModal, setExpenseModal] = useState(false)
  const [form, setForm] = useState(EMPTY_EXPENSE)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('transactions')

  useEffect(() => {
    fetchData()
    const a = supabase.channel('dash-tx').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData).subscribe()
    const b = supabase.channel('dash-exp').on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchData).subscribe()
    return () => { supabase.removeChannel(a); supabase.removeChannel(b) }
  }, [])

  async function fetchData() {
    const [tr, er] = await Promise.all([
      supabase.from('transactions').select('*, items(name, category)').order('date', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
    ])
    if (!tr.error) setTransactions(tr.data ?? [])
    if (!er.error) setExpenses(er.data ?? [])
    setLoading(false)
  }

  async function handleAddExpense() {
    const amount = parseFloat(form.amount)
    if (!form.reason.trim()) return toast.error('Reason is required')
    if (isNaN(amount) || amount <= 0) return toast.error('Enter a valid amount')
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({ amount, reason: form.reason.trim(), date: form.date })
    setSaving(false)
    if (error) return toast.error('Failed: ' + error.message)
    toast.success('Expense recorded')
    setExpenseModal(false)
    setForm(EMPTY_EXPENSE)
  }

  async function deleteExpense(id) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) toast.error('Delete failed')
    else toast.success('Deleted')
  }

  async function deleteTransaction(tx) {
    if (!confirm(`Delete this sale and restore ${tx.qty_sold}× ${tx.items?.name ?? 'item'} back to stock?`)) return

    // Delete the transaction
    const { error: delErr } = await supabase.from('transactions').delete().eq('id', tx.id)
    if (delErr) return toast.error('Delete failed: ' + delErr.message)

    // Restore stock if item still exists
    if (tx.item_id) {
      const { data: item } = await supabase.from('items').select('qty, category').eq('id', tx.item_id).single()
      if (item) {
        const MAX = { 'Blox Fruit': 4 }
        const max = MAX[item.category]
        let newQty = item.qty + tx.qty_sold
        if (max && newQty > max) {
          newQty = max
          toast(`Stock capped at ${max} for ${item.category}`, { icon: '⚠️' })
        }
        await supabase.from('items').update({ qty: newQty }).eq('id', tx.item_id)
      }
    }
    toast.success('Sale deleted, stock restored')
  }

  const totalEarned = transactions.reduce((s, t) => s + t.total, 0)
  const totalSpent  = expenses.reduce((s, e) => s + e.amount, 0)
  const net = totalEarned - totalSpent

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const todaysTx = transactions.filter((t) => new Date(t.date) >= startOfToday)
  const todaysEarned = todaysTx.reduce((s, t) => s + t.total, 0)

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-600">Loading...</div>

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Today" value={`₱${todaysEarned.toLocaleString()}`} sub={`${todaysTx.length} sale${todaysTx.length === 1 ? '' : 's'}`} Icon={Calendar} accent="#06b6d4" accentBg="#082f3a" />
        <StatCard label="Total Earned" value={`₱${totalEarned.toLocaleString()}`} sub={`${transactions.length} sales`} Icon={TrendingUp} accent="#10b981" accentBg="#052e16" />
        <StatCard label="Total Spent"  value={`₱${totalSpent.toLocaleString()}`}  sub={`${expenses.length} expenses`} Icon={TrendingDown} accent="#f43f5e" accentBg="#1c0a0a" />
        <StatCard
          label="Net Balance"
          value={`${net < 0 ? '−' : ''}₱${Math.abs(net).toLocaleString()}`}
          sub={net >= 0 ? 'In profit' : 'In the red'}
          Icon={Wallet}
          accent={net >= 0 ? '#8b5cf6' : '#f97316'}
          accentBg={net >= 0 ? '#1a0a3a' : '#1c0f00'}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl" style={S.card}>
          {[
            { id: 'transactions', label: `Sales (${transactions.length})`,   Icon: Receipt },
            { id: 'expenses',     label: `Expenses (${expenses.length})`,    Icon: CreditCard },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={activeTab === id
                ? { background: '#1c1c2e', color: '#a78bfa', border: '1px solid #7c3aed' }
                : { color: '#4b5563', border: '1px solid transparent' }
              }
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setForm(EMPTY_EXPENSE); setExpenseModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
          style={{ background: '#141422', border: '1px solid #24243c' }}
        >
          <Plus size={14} /> Add Expense
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={S.card}>
        {activeTab === 'transactions' ? (
          transactions.length === 0
            ? <EmptyState icon={<Receipt size={36} />} text="No sales recorded yet" />
            : <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid #1c1c2e' }}>
                  {['Item', 'Game', 'Qty', 'Total', 'Date', 'Notes', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#3d3d60' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="transition-colors" style={{ borderBottom: '1px solid #141422' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1c1c2e')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3 text-white font-medium">{tx.items?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{tx.items?.category ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{tx.qty_sold}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#10b981' }}>+₱{tx.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{fmtDateTime(tx.date)}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs max-w-[120px] truncate">{tx.notes ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteTransaction(tx)} className="text-slate-700 hover:text-red-400 transition-colors" title="Delete & restore stock">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        ) : (
          expenses.length === 0
            ? <EmptyState icon={<CreditCard size={36} />} text="No expenses recorded yet" />
            : <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid #1c1c2e' }}>
                  {['Reason', 'Amount', 'Date', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#3d3d60' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="transition-colors" style={{ borderBottom: '1px solid #141422' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1c1c2e')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3 text-white font-medium">{exp.reason}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#f43f5e' }}>−₱{exp.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{new Date(exp.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteExpense(exp.id)} className="text-slate-700 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}
      </div>

      {/* Add Expense Modal */}
      {expenseModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={(e) => e.target === e.currentTarget && setExpenseModal(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ background: '#141422', border: '1px solid #24243c' }}>
            <h3 className="text-white font-bold text-lg mb-5">Add Expense</h3>
            <div className="flex flex-col gap-4">
              {[
                { label: 'Amount (₱) *', type: 'number', placeholder: '0', key: 'amount' },
                { label: 'Reason *', type: 'text', placeholder: 'e.g. Bought fruit for resale', key: 'reason' },
                { label: 'Date', type: 'date', placeholder: '', key: 'date' },
              ].map(({ label, type, placeholder, key }) => (
                <div key={key}>
                  <label className="text-slate-500 text-xs font-medium block mb-1.5">{label}</label>
                  <input type={type} style={S.input} placeholder={placeholder} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} onFocus={(e) => (e.target.style.borderColor = '#7c3aed')} onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setExpenseModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300" style={{ background: '#1c1c2e' }}>Cancel</button>
              <button onClick={handleAddExpense} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, Icon, accent, accentBg }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: '#141422', border: `1px solid ${accent}30` }}>
      <div className="flex items-start justify-between">
        <p className="text-slate-500 text-sm">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accentBg }}>
          <Icon size={15} style={{ color: accent }} />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      <p className="text-xs text-slate-600">{sub}</p>
    </div>
  )
}

function fmtDateTime(d) {
  return new Date(d).toLocaleString([], { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' })
}

function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-20 text-slate-700 flex flex-col items-center gap-3">
      <div className="opacity-20">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  )
}
