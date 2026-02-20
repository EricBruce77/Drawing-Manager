import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

// Generate a consistent color from a name string
function getAvatarColor(name) {
  const colors = [
    'from-blue-500 to-blue-600',
    'from-emerald-500 to-emerald-600',
    'from-violet-500 to-violet-600',
    'from-amber-500 to-amber-600',
    'from-rose-500 to-rose-600',
    'from-cyan-500 to-cyan-600',
    'from-fuchsia-500 to-fuchsia-600',
    'from-orange-500 to-orange-600',
  ]
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function Sidebar({ activeTab, setActiveTab, onClose, className = '' }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const mainItems = [
    {
      id: 'all-drawings',
      label: 'All Drawings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      roles: ['admin', 'engineer', 'viewer'],
    },
    {
      id: 'upload',
      label: 'Upload',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      roles: ['admin', 'engineer', 'viewer'],
    },
  ]

  const managementItems = [
    {
      id: 'customers',
      label: 'Customers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      roles: ['admin', 'engineer', 'viewer'],
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      roles: ['admin', 'engineer', 'viewer'],
    },
    {
      id: 'activity',
      label: 'Activity Log',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      roles: ['admin', 'engineer', 'viewer'],
    },
    {
      id: 'user-access',
      label: 'User Access',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      roles: ['admin'],
    },
  ]

  const bottomItems = [
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      roles: ['admin', 'engineer', 'viewer'],
    },
  ]

  const canAccessItem = (item) => {
    return item.roles.includes(profile?.role)
  }

  const renderNavItem = (item) => {
    if (!canAccessItem(item)) return null
    const isActive = activeTab === item.id
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`group w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] rounded-lg transition-all duration-150 text-sm relative ${
          isActive
            ? 'bg-blue-600/15 text-blue-400 font-semibold'
            : 'text-slate-400 hover:bg-slate-700/60 hover:text-white hover:translate-x-0.5'
        }`}
      >
        {/* Active indicator bar */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-500 rounded-r-full" />
        )}
        <span className={`transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
          {item.icon}
        </span>
        <span>{item.label}</span>
      </button>
    )
  }

  const avatarColor = getAvatarColor(profile?.full_name)

  return (
    <div className={`w-64 bg-slate-800 border-r border-slate-700 flex flex-col max-h-screen ${className}`}>
      {/* Logo/Brand */}
      <div className="p-4 sm:p-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-white font-bold text-base tracking-tight">ARO Tech</h2>
            <p className="text-slate-500 text-xs font-medium">Drawing Manager</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white lg:hidden p-2 -m-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 pb-2 overflow-y-auto space-y-5">
        {/* Main section */}
        <div className="space-y-1">
          <p className="px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Main</p>
          {mainItems.map(renderNavItem)}
        </div>

        {/* Management section */}
        <div className="space-y-1">
          <p className="px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Management</p>
          {managementItems.map(renderNavItem)}
        </div>

        {/* Settings */}
        <div className="space-y-1">
          {bottomItems.map(renderNavItem)}
        </div>
      </nav>

      {/* User Profile & Logout */}
      <div className="p-3 border-t border-slate-700/60 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2">
          <div className={`w-9 h-9 bg-gradient-to-br ${avatarColor} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <span className="text-white text-sm font-bold">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {profile?.full_name}
            </p>
            <p className="text-slate-500 text-xs capitalize">
              {profile?.role}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full px-4 py-2.5 min-h-[44px] bg-slate-700/40 hover:bg-red-600/15 text-slate-400 hover:text-red-400 rounded-lg transition-all duration-150 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  )
}
