import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../contexts/ToastContext'
import DrawingCard from './DrawingCard'

export default function FolderView({ searchQuery, refreshToken }) {
  const toast = useToast()
  const [customers, setCustomers] = useState([])
  const [expandedCustomers, setExpandedCustomers] = useState(new Set())
  const [customerDrawings, setCustomerDrawings] = useState({})
  const [loading, setLoading] = useState(true)
  const [completionFilter, setCompletionFilter] = useState('all') // 'all', 'pending', 'in_progress', 'completed'

  useEffect(() => {
    fetchCustomersAndDrawings()
  }, [searchQuery, refreshToken, completionFilter])

  // Real-time subscription for new drawings (e.g., from Google Drive via n8n)
  useEffect(() => {
    const channel = supabase
      .channel('folder-view-drawings-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'drawings'
        },
        (payload) => {
          console.log('Drawing changed in folder view:', payload)
          // Refresh when any drawing changes
          fetchCustomersAndDrawings()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [searchQuery, completionFilter]) // Re-subscribe when filters change

  const fetchCustomersAndDrawings = async () => {
    setLoading(true)
    try {
      // Fetch all customers (we'll count drawings separately)
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name')
        .order('name')

      if (customersError) throw customersError

      // Fetch drawings grouped by customer (no joins needed - using customer_name directly)
      let drawingsQuery = supabase
        .from('drawings')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      // Apply completion filter
      if (completionFilter !== 'all') {
        drawingsQuery = drawingsQuery.eq('completion_status', completionFilter)
      }

      // Apply search filter if present
      if (searchQuery?.trim()) {
        // Use the same search RPC we have
        const { data: searchResults, error: searchError } = await supabase.rpc(
          'search_drawings',
          { search_query: searchQuery.trim() }
        )

        if (searchError) throw searchError

        if (searchResults && searchResults.length > 0) {
          const ids = searchResults.map(r => r.id)
          drawingsQuery = drawingsQuery.in('id', ids)
        } else {
          // No search results, show nothing
          setCustomers([])
          setCustomerDrawings({})
          setLoading(false)
          return
        }
      }

      const { data: drawingsData, error: drawingsError } = await drawingsQuery

      if (drawingsError) throw drawingsError

      // Group drawings by customer name
      const grouped = {}
      const customerIdMap = {} // Map customer names to IDs for grouping

      // Create a map of customer names to IDs
      customersData.forEach(customer => {
        customerIdMap[customer.name] = customer.id
      })

      drawingsData.forEach(drawing => {
        const customerName = drawing.customer_name
        const customerId = customerIdMap[customerName] || 'uncategorized'

        if (!grouped[customerId]) {
          grouped[customerId] = []
        }
        grouped[customerId].push(drawing)
      })

      // Add uncategorized customer if there are drawings without customer
      const allCustomers = [...customersData]
      if (grouped['uncategorized'] && grouped['uncategorized'].length > 0) {
        allCustomers.push({
          id: 'uncategorized',
          name: 'Uncategorized'
        })
      }

      setCustomers(allCustomers)
      setCustomerDrawings(grouped)
    } catch (error) {
      console.error('Error fetching folder view:', error)
      toast.error('Error loading folders: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleCustomer = (customerId) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId)
    } else {
      newExpanded.add(customerId)
    }
    setExpandedCustomers(newExpanded)
  }

  const handleView = async (drawing) => {
    try {
      if (!drawing.file_url) {
        toast.error('No file path for this drawing.')
        return
      }

      const { data, error } = await supabase.storage
        .from('drawings')
        .createSignedUrl(drawing.file_url, 3600)

      if (error) throw error
      if (data?.signedUrl) {
        // Open signed URL in new tab for quick viewing
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      console.error('Error opening drawing:', err)
      toast.error('Error opening drawing: ' + (err.message || err))
    }
  }

  const handleDownload = async (drawing) => {
    try {
      if (!drawing.file_url) {
        toast.error('No file path for this drawing.')
        return
      }

      const { data, error } = await supabase.storage
        .from('drawings')
        .createSignedUrl(drawing.file_url, 3600)

      if (error) throw error
      if (data?.signedUrl) {
        const link = document.createElement('a')
        link.href = data.signedUrl
        link.download = drawing.file_name || 'drawing'
        link.click()
      }
    } catch (err) {
      console.error('Error downloading drawing:', err)
      toast.error('Error downloading drawing: ' + (err.message || err))
    }
  }

  const expandAll = () => {
    setExpandedCustomers(new Set(customers.map(c => c.id)))
  }

  const collapseAll = () => {
    setExpandedCustomers(new Set())
  }

  const getCompletionStats = (drawings = []) => {
    const completed = drawings.filter(d => d.completion_status === 'completed').length
    const inProgress = drawings.filter(d => d.completion_status === 'in_progress').length
    const pending = drawings.filter(d => d.completion_status === 'pending').length
    return { completed, inProgress, pending, total: drawings.length }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
          >
            Collapse All
          </button>
        </div>

        {/* Completion Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-300">Status:</label>
          <select
            value={completionFilter}
            onChange={(e) => setCompletionFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Folder Tree */}
      <div className="space-y-2">
        {customers.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-white">No customers found</h3>
            <p className="mt-2 text-slate-400">
              {searchQuery ? 'Try adjusting your search' : 'Add customers to organize your drawings'}
            </p>
          </div>
        ) : (
          customers.map(customer => {
            const drawings = customerDrawings[customer.id] || []
            const stats = getCompletionStats(drawings)
            const isExpanded = expandedCustomers.has(customer.id)

            return (
              <div key={customer.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                {/* Customer Header */}
                <button
                  onClick={() => toggleCustomer(customer.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Folder Icon */}
                    <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>

                    {/* Customer Name */}
                    <h3 className="text-lg font-semibold text-white">{customer.name}</h3>

                    {/* Drawing Count */}
                    <span className="text-sm text-slate-400">({stats.total} drawings)</span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Completion Stats */}
                    {stats.total > 0 && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-400">✓ {stats.completed}</span>
                        <span className="text-yellow-400">⟳ {stats.inProgress}</span>
                        <span className="text-slate-400">○ {stats.pending}</span>
                      </div>
                    )}

                    {/* Expand/Collapse Icon */}
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Drawings Grid (Expanded) */}
                {isExpanded && (
                  <div className="p-4 bg-slate-900/50 border-t border-slate-700">
                    {drawings.length === 0 ? (
                      <p className="text-slate-400 text-center py-8">No drawings for this customer</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {drawings.map(drawing => (
                          <DrawingCard
                            key={drawing.id}
                            drawing={drawing}
                            showCompletionStatus={true}
                            onStatusChange={fetchCustomersAndDrawings}
                            onView={() => handleView(drawing)}
                            onDownload={() => handleDownload(drawing)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
