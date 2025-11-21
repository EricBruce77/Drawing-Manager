import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
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
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-900">
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
        <header className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-start sm:items-center gap-3 w-full">
              <button
                className="lg:hidden p-2 rounded-md bg-slate-700 text-white"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                  {activeTab === 'all-drawings' && 'All Drawings'}
                  {activeTab === 'upload' && 'Upload Drawings'}
                  {activeTab === 'customers' && 'Customers & Projects'}
                  {activeTab === 'projects' && 'Projects'}
                  {activeTab === 'activity' && 'Activity Log'}
                  {activeTab === 'user-access' && 'User Access Control'}
                  {activeTab === 'settings' && 'Settings'}
                </h1>
                <p className="text-slate-400 text-sm mt-1 truncate">
                  Welcome back, {profile?.full_name || 'User'} ({profile?.role})
                </p>
              </div>
            </div>

            {activeTab === 'all-drawings' && (
              <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-center">
                {/* View Toggle */}
                <div className="flex bg-slate-700 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('folder')}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      viewMode === 'folder'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Drawing
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
                />
              )}

              {/* Grid or Folder View */}
              {viewMode === 'grid' ? (
                <DrawingsGrid
                  searchQuery={searchQuery}
                  selectedCustomer={selectedCustomer}
                  selectedProject={selectedProject}
                  showUpdatesOnly={showUpdatesOnly}
                  refreshToken={refreshToken}
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
