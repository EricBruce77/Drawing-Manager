import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function SearchBar({ searchQuery, setSearchQuery, selectedCustomer, setSelectedCustomer, selectedProject, setSelectedProject, showUpdatesOnly, setShowUpdatesOnly }) {
  const [customers, setCustomers] = useState([])
  const [projects, setProjects] = useState([])
  const [localSearchValue, setLocalSearchValue] = useState(searchQuery)

  useEffect(() => {
    fetchCustomers()
    fetchProjects()
  }, [])

  // Debounce search query - wait 200ms after user stops typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(localSearchValue)
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [localSearchValue, setSearchQuery])

  // Sync local value when external search query changes (e.g., from Clear button)
  useEffect(() => {
    setLocalSearchValue(searchQuery)
  }, [searchQuery])

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name')
      .order('name')

    if (!error && data) {
      setCustomers(data)
    }
  }

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, project_number')
      .order('project_number')

    if (!error && data) {
      setProjects(data)
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={localSearchValue}
              onChange={(e) => setLocalSearchValue(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search by part number, customer name, description, or keywords..."
            />
          </div>
        </div>

        {/* Customer Filter */}
        <div className="w-full md:w-64">
          <select
            value={selectedCustomer || ''}
            onChange={(e) => setSelectedCustomer(e.target.value || null)}
            className="block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.name}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        {/* Project Filter */}
        <div className="w-full md:w-64">
          <select
            value={selectedProject || ''}
            onChange={(e) => setSelectedProject(e.target.value || null)}
            className="block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.name}>
                {project.project_number} - {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Updates Only Filter */}
        <div className="flex items-center">
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors">
            <input
              type="checkbox"
              checked={showUpdatesOnly || false}
              onChange={(e) => setShowUpdatesOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-500 text-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 bg-slate-600"
            />
            <span className="text-sm text-slate-300 whitespace-nowrap flex items-center gap-1">
              <span className="text-orange-400">⚠</span>
              Updates Only
            </span>
          </label>
        </div>

        {/* Clear Filters */}
        {(searchQuery || selectedCustomer || selectedProject || showUpdatesOnly) && (
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedCustomer(null)
              setSelectedProject(null)
              setShowUpdatesOnly(false)
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search Tips */}
      {searchQuery && (
        <div className="mt-3 text-sm text-slate-400">
          <p>Searching for: <span className="text-white font-medium">{searchQuery}</span></p>
        </div>
      )}
    </div>
  )
}