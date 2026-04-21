import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { Package, ShoppingCart, LayoutDashboard, ChevronRight } from 'lucide-react'
import ItemCatalog from './pages/ItemCatalog'
import POSScreen from './pages/POSScreen'
import Dashboard from './pages/Dashboard'
import robloxLogo from './roblox.png'

const TABS = [
  { id: 'pos',       label: 'POS / Sell',   Icon: ShoppingCart },
  { id: 'catalog',   label: 'Item Catalog', Icon: Package },
  { id: 'dashboard', label: 'Dashboard',    Icon: LayoutDashboard },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('pos')
  const active = TABS.find((t) => t.id === activeTab)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#07070f' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#141422', color: '#e8e8f0', border: '1px solid #2e2e4a', borderRadius: '12px' },
          success: { iconTheme: { primary: '#8b5cf6', secondary: '#07070f' } },
        }}
      />

      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: '#0e0e1a', borderRight: '1px solid #1c1c2e' }}>

        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid #1c1c2e' }}>
          <div className="relative">
            <img src={robloxLogo} alt="Roblox" className="w-9 h-9 rounded-xl object-contain" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-violet-500 border-2" style={{ borderColor: '#0e0e1a' }} />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Trading POS</p>
            <p className="text-violet-400 text-xs font-medium">Income Tracker</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 flex flex-col gap-0.5">
          <p className="text-xs font-semibold uppercase tracking-widest px-3 mb-3" style={{ color: '#3d3d60' }}>Menu</p>
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative overflow-hidden ${
                  isActive ? 'text-violet-300' : 'text-slate-500 hover:text-slate-200'
                }`}
                style={isActive ? { background: '#1c1c2e' } : {}}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-violet-500" />
                )}
                <Icon
                  size={16}
                  className={isActive ? 'text-violet-400' : 'text-slate-600 group-hover:text-slate-400'}
                />
                <span className="flex-1 text-left">{label}</span>
                {isActive && <ChevronRight size={13} className="text-violet-500" />}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid #1c1c2e' }}>
          <p className="text-xs text-center" style={{ color: '#2e2e4a' }}>v1.0</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header
          className="h-14 flex items-center px-6 gap-3 flex-shrink-0"
          style={{ background: '#0e0e1a', borderBottom: '1px solid #1c1c2e' }}
        >
          {active && <active.Icon size={16} className="text-violet-400" />}
          <h1 className="text-white font-semibold text-sm">{active?.label}</h1>
        </header>

        {/* Page */}
        <div className="flex-1 overflow-auto p-5">
          {activeTab === 'catalog'   && <ItemCatalog />}
          {activeTab === 'pos'       && <POSScreen />}
          {activeTab === 'dashboard' && <Dashboard />}
        </div>
      </main>
    </div>
  )
}
