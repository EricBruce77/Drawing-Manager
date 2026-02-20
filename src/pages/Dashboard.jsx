import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePinnedDrawings } from '../hooks/usePinnedDrawings'
import Sidebar from '../components/Sidebar'
import DrawingsGrid from '../components/DrawingsGrid'
import FolderView from '../components/FolderView'
import UploadDrawing from '../components/UploadDrawing'
import SearchBar from '../components/SearchBar'
import CustomersProjects from '../components/CustomersProjects'
import Projects from '../components/Projects'
import ActivityLog from '../components/ActivityLog'
import Settings from '../components/Settings'
import UserManagement from '../components/UserManagement'

export default function Dashboard() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('all-drawings')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'folder'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [showUpdatesOnly, setShowUpdatesOnly] = useState(false)
  const [showNotesOnly, setShowNotesOnly] = useState(false)
  const [showCompletedOnly, setShowCompletedOnly] = useState(false)
  const [showInProgressOnly, setShowInProgressOnly] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Sort & Pagination
  const [sortOption, setSortOption] = useState('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Pinned drawings
  const { pinnedIds, togglePin } = usePinnedDrawings()

  // Reset page when filters/search/sort change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCustomer, selectedProject, showUpdatesOnly, showNotesOnly, showCompletedOnly, showInProgressOnly, sortOption])

  // Count active filters
  const activeFilterCount = [showUpdatesOnly, showNotesOnly, showCompletedOnly, showInProgressOnly, !!selectedCustomer, !!selectedProject].filter(Boolean).length

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      if (e.key === 'Escape' && showUploadModal) {
        setShowUploadModal(false)
      } else if (e.key === '/' && activeTab === 'all-drawings') {
        e.preventDefault()
        const input = document.querySelector('[data-search-input]')
        if (input) input.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showUploadModal, activeTab])

  return (
    <div className="flex h-screen bg-slate-900" style={{ height: '100dvh' }}>
      {/* Sidebar - desktop */}
      <div className="hidden lg:flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Sidebar - mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)}></div>
          <div className="relative z-10 h-full">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(id) => {
                setActiveTab(id)
                setSidebarOpen(false)
              }}
              onClose={() => setSidebarOpen(false)}
              className="h-full shadow-xl"
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                className="lg:hidden p-2 rounded-md bg-slate-700 text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                  {activeTab === 'all-drawings' && (
                    <>
                      All Drawings
                      {totalCount > 0 && (
                        <span className="ml-2 text-base font-normal text-slate-400">({totalCount})</span>
                      )}
                      {activeFilterCount > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-blue-600 text-white rounded-full">{activeFilterCount}</span>
                      )}
                    </>
                  )}
                  {activeTab === 'upload' && 'Upload Drawings'}
                  {activeTab === 'customers' && 'Customers & Projects'}
                  {activeTab === 'projects' && 'Projects'}
                  {activeTab === 'activity' && 'Activity Log'}
                  {activeTab === 'user-access' && 'User Access Control'}
                  {activeTab === 'settings' && 'Settings'}
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">
                  Welcome back, {profile?.full_name || 'User'} ({profile?.role})
                </p>
              </div>
            </div>

            {activeTab === 'all-drawings' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* View Toggle */}
                <div className="flex bg-slate-700 rounded-lg p-1 flex-shrink-0">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 min-h-[44px] rounded text-sm transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    aria-label="Grid view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('folder')}
                    className={`px-3 py-2 min-h-[44px] rounded text-sm transition-colors ${
                      viewMode === 'folder'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    aria-label="Folder view"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Upload Drawing</span>
                  <span className="sm:hidden">Upload</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {activeTab === 'all-drawings' && (
            <div className="space-y-6">
              {/* Search and Filters (only show for grid view) */}
              {viewMode === 'grid' && (
                <SearchBar
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedCustomer={selectedCustomer}
                  setSelectedCustomer={setSelectedCustomer}
                  selectedProject={selectedProject}
                  setSelectedProject={setSelectedProject}
                  showUpdatesOnly={showUpdatesOnly}
                  setShowUpdatesOnly={setShowUpdatesOnly}
                  showNotesOnly={showNotesOnly}
                  setShowNotesOnly={setShowNotesOnly}
                  showCompletedOnly={showCompletedOnly}
                  setShowCompletedOnly={setShowCompletedOnly}
                  showInProgressOnly={showInProgressOnly}
                  setShowInProgressOnly={setShowInProgressOnly}
                  sortOption={sortOption}
                  setSortOption={setSortOption}
                />
              )}

              {/* Grid or Folder View */}
              {viewMode === 'grid' ? (
                <DrawingsGrid
                  searchQuery={searchQuery}
                  selectedCustomer={selectedCustomer}
                  selectedProject={selectedProject}
                  showUpdatesOnly={showUpdatesOnly}
                  showNotesOnly={showNotesOnly}
                  showCompletedOnly={showCompletedOnly}
                  showInProgressOnly={showInProgressOnly}
                  refreshToken={refreshToken}
                  sortOption={sortOption}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  setTotalCount={setTotalCount}
                  pinnedIds={pinnedIds}
                  togglePin={togglePin}
                />
              ) : (
                <FolderView
                  searchQuery={searchQuery}
                  refreshToken={refreshToken}
                />
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <UploadDrawing />
          )}

          {activeTab === 'customers' && (
            <CustomersProjects />
          )}

          {activeTab === 'projects' && (
            <Projects />
          )}

          {activeTab === 'activity' && (
            <ActivityLog />
          )}

          {activeTab === 'user-access' && (
            <UserManagement />
          )}

          {activeTab === 'settings' && (
            <Settings />
          )}
        </main>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Upload Drawing</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <UploadDrawing onComplete={() => {
              setShowUploadModal(false)
              setRefreshToken(prev => prev + 1)
            }} />
          </div>
        </div>
      )}
    </div>
  )
}
