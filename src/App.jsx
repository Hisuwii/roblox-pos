import { useState } from 'react'
import { Toaster, toast, ToastBar } from 'react-hot-toast'
import { Package, ShoppingCart, LayoutDashboard, ChevronRight, X } from 'lucide-react'
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
          duration: 3500,
          style: { background: '#141422', color: '#e8e8f0', border: '1px solid #2e2e4a', borderRadius: '12px', padding: '4px 8px 4px 12px' },
          success: { iconTheme: { primary: '#8b5cf6', secondary: '#07070f' } },
        }}
      >
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <>
                {icon}
                {message}
                {t.type !== 'loading' && (
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="ml-1 p-1 rounded-md hover:bg-white/10 transition-colors text-slate-400 hover:text-white flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                )}
              </>
            )}
          </ToastBar>
        )}
      </Toaster>

      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col" style={{ background: '#0e0e1a', borderRight: '1px solid #1c1c2e' }}>
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

        <nav className="flex-1 px-3 py-5 flex flex-col gap-0.5">
          <p className="text-xs font-semibold uppercase tracking-widest px-3 mb-3" style={{ color: '#3d3d60' }}>Menu</p>
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative"
                style={isActive ? { background: '#1c1c2e', color: '#c4b5fd' } : { color: '#6b7280' }}
              >
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-violet-500" />}
                <Icon size={16} style={{ color: isActive ? '#a78bfa' : '#4b5563' }} />
                <span className="flex-1 text-left">{label}</span>
                {isActive && <ChevronRight size={13} className="text-violet-500" />}
              </button>
            )
          })}
        </nav>

        <div className="px-4 py-4" style={{ borderTop: '1px solid #1c1c2e' }}>
          <p className="text-xs text-center" style={{ color: '#2e2e4a' }}>v1.0</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-14 flex items-center px-4 gap-3 flex-shrink-0" style={{ background: '#0e0e1a', borderBottom: '1px solid #1c1c2e' }}>
          <img src={robloxLogo} alt="Roblox" className="w-7 h-7 rounded-lg object-contain lg:hidden" />
          {active && <active.Icon size={16} className="text-violet-400 hidden lg:block" />}
          <h1 className="text-white font-semibold text-sm">{active?.label}</h1>
        </header>

        {/* Page — leave room for bottom nav on mobile */}
        <div className="flex-1 overflow-auto p-4 lg:p-5 pb-20 lg:pb-5">
          {activeTab === 'catalog'   && <ItemCatalog />}
          {activeTab === 'pos'       && <POSScreen />}
          {activeTab === 'dashboard' && <Dashboard />}
        </div>
      </main>

      {/* Bottom nav — mobile only */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 flex z-40"
        style={{ background: '#0e0e1a', borderTop: '1px solid #1c1c2e' }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors"
              style={{ color: isActive ? '#a78bfa' : '#4b5563' }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label.split(' /')[0]}</span>
              {isActive && <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-violet-500" />}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
