import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import DrawingCard from './DrawingCard'
import DrawingAnnotator from './DrawingAnnotator'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Set up PDF.js worker - use bundled worker instead of CDN (React 19 + pdf.js v5 blocks CDN)
// Fallback to CDN if the local worker path fails (e.g., dev server cannot serve ?url assets)
pdfjs.GlobalWorkerOptions.workerSrc =
  workerSrc && !workerSrc.includes('node_modules')
    ? workerSrc
    : `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export default function DrawingsGrid({ searchQuery, selectedCustomer, selectedProject, showUpdatesOnly, showNotesOnly, showCompletedOnly, showInProgressOnly, refreshToken }) {
  const [drawings, setDrawings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDrawing, setSelectedDrawing] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  useEffect(() => {
    fetchDrawings()
  }, [searchQuery, selectedCustomer, selectedProject, showUpdatesOnly, showNotesOnly, showCompletedOnly, showInProgressOnly, refreshToken])

  // Real-time subscription for new drawings (e.g., from Google Drive via n8n)
  useEffect(() => {
    const channel = supabase
      .channel('drawings-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'drawings'
        },
        (payload) => {
          console.log('New drawing added:', payload.new)
          // Refresh drawings when a new one is inserted
          fetchDrawings(false)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drawings'
        },
        (payload) => {
          console.log('Drawing updated:', payload.new)
          // Refresh when a drawing is updated
          fetchDrawings(false)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'drawings'
        },
        (payload) => {
          console.log('Drawing deleted:', payload.old)
          // Refresh when a drawing is deleted
          fetchDrawings(false)
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [searchQuery, selectedCustomer, selectedProject, showUpdatesOnly, showNotesOnly, showCompletedOnly, showInProgressOnly]) // Re-subscribe when filters change

  // Helper function to build base select query
  const baseSelect = () =>
    supabase
      .from('drawings')
      .select(`
        *,
        needs_update,
        update_description,
        update_requested_at,
        update_requested_by
      `)
      .eq('status', 'active')

  // Helper to apply customer, project, and updates filter if selected
  const applySharedFilters = (query) => {
    let filteredQuery = query
    if (selectedCustomer) {
      filteredQuery = filteredQuery.eq('customer_name', selectedCustomer)
    }
    if (selectedProject) {
      filteredQuery = filteredQuery.eq('project_name', selectedProject)
    }
    if (showUpdatesOnly) {
      filteredQuery = filteredQuery.eq('needs_update', true)
    }
    if (showNotesOnly) {
      filteredQuery = filteredQuery.not('notes', 'is', null).neq('notes', '')
    }
    if (showCompletedOnly) {
      filteredQuery = filteredQuery.eq('completion_status', 'completed')
    }
    if (showInProgressOnly) {
      filteredQuery = filteredQuery.eq('completion_status', 'in_progress')
    }
    return filteredQuery
  }

  const fetchDrawings = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      // Normalize search query: trim and lowercase for consistency
      const normalizedQuery = searchQuery?.trim()

      // No search query - return all (with optional customer filter)
      if (!normalizedQuery) {
        const { data, error } = await applySharedFilters(
          baseSelect().order('created_at', { ascending: false })
        )
        if (error) throw error

        // Thumbnails are already public URLs from the Edge Function, use them directly
        setDrawings(data || [])
        return
      }

      // Use advanced search RPC with relevance ranking
      // The RPC handles exact matches, partial matches, and full-text search
      const { data: rankedMatches, error: searchError } = await supabase.rpc(
        'search_drawings',
        { search_query: normalizedQuery }
      )

      if (searchError) throw searchError

      // If no results from RPC, set empty array
      if (!rankedMatches || rankedMatches.length === 0) {
        setDrawings([])
        return
      }

      // Extract IDs from ranked results
      const ids = rankedMatches.map((match) => match.id)

      // Fetch full drawing data for matched IDs (with customer filter if needed)
      const { data: fullDrawings, error: fetchError } = await applySharedFilters(
        baseSelect().in('id', ids)
      )

      if (fetchError) throw fetchError

      // Sort by relevance order from RPC (already sorted by relevance DESC)
      const order = new Map(ids.map((id, index) => [id, index]))
      const sortedDrawings = (fullDrawings || []).sort(
        (a, b) => order.get(a.id) - order.get(b.id)
      )

      // Thumbnails are already public URLs from the Edge Function, use them directly
      setDrawings(sortedDrawings)
    } catch (error) {
      console.error('Error fetching drawings:', error)
      alert('Error searching drawings: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (drawing) => {
    try {
      // Check if file_url exists
      if (!drawing.file_url) {
        alert('File path not found. This drawing may be from an older version.')
        return
      }

      // Get signed URL for download (file_url contains the storage path)
      const { data, error } = await supabase.storage
        .from('drawings')
        .createSignedUrl(drawing.file_url, 60)

      if (error) throw error

      // Download file
      const link = document.createElement('a')
      link.href = data.signedUrl
      link.download = drawing.file_name
      link.click()

      // Log activity
      await supabase.from('activity_log').insert({
        drawing_id: drawing.id,
        activity: 'download',
        details: { file_name: drawing.file_name }
      })
    } catch (error) {
      console.error('Error downloading:', error)
      alert('Error downloading file: ' + error.message)
    }
  }

  const handleDelete = async (drawing) => {
    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete drawing "${drawing.part_number}"?\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    try {
      // Delete file from storage
      if (drawing.file_url) {
        const { error: storageError } = await supabase.storage
          .from('drawings')
          .remove([drawing.file_url])

        if (storageError) {
          console.warn('Storage deletion warning:', storageError)
          // Continue even if storage deletion fails
        }
      }

      // Delete database record
      const { error: dbError } = await supabase
        .from('drawings')
        .delete()
        .eq('id', drawing.id)

      if (dbError) throw dbError

      alert('Drawing deleted successfully!')

      // Close modal and refresh list
      setSelectedDrawing(null)
      fetchDrawings()
    } catch (error) {
      console.error('Error deleting drawing:', error)
      alert('Error deleting drawing: ' + error.message)
    }
  }

  // Toggle select mode
  const toggleSelectMode = () => {
    setSelectMode(!selectMode)
    setSelectedIds(new Set()) // Clear selections when toggling mode
  }

  // Toggle selection of a drawing
  const toggleDrawingSelection = (drawingId) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(drawingId)) {
      newSelected.delete(drawingId)
    } else {
      newSelected.add(drawingId)
    }
    setSelectedIds(newSelected)
  }

  // Select all drawings in current view
  const selectAll = () => {
    setSelectedIds(new Set(drawings.map(d => d.id)))
  }

  // Deselect all
  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  // Bulk delete selected drawings
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert('No drawings selected')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} selected drawing(s)?\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    const selectedDrawings = drawings.filter(d => selectedIds.has(d.id))
    const results = { success: [], failed: [] }

    for (const drawing of selectedDrawings) {
      try {
        // Delete file from storage
        if (drawing.file_url) {
          const { error: storageError } = await supabase.storage
            .from('drawings')
            .remove([drawing.file_url])

          if (storageError) {
            console.warn('Storage deletion warning for', drawing.part_number, ':', storageError)
          }
        }

        // Delete database record
        const { error: dbError } = await supabase
          .from('drawings')
          .delete()
          .eq('id', drawing.id)

        if (dbError) throw dbError

        results.success.push(drawing.part_number)
      } catch (error) {
        console.error('Error deleting drawing:', drawing.part_number, error)
        results.failed.push({ partNumber: drawing.part_number, error: error.message })
      }
    }

    // Show results
    let message = `Successfully deleted ${results.success.length} drawing(s)`
    if (results.failed.length > 0) {
      message += `\n\nFailed to delete ${results.failed.length} drawing(s):`
      results.failed.forEach(f => {
        message += `\n- ${f.partNumber}: ${f.error}`
      })
    }
    alert(message)

    // Clear selections and refresh
    setSelectedIds(new Set())
    setSelectMode(false)
    fetchDrawings()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (drawings.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">No drawings found</h3>
        <p className="mt-2 text-slate-400">
          {searchQuery || selectedCustomer
            ? 'Try adjusting your search or filters'
            : 'Upload your first drawing to get started'}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Toolbar for bulk actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={toggleSelectMode}
          className={`px-4 py-2 min-h-[44px] rounded-lg font-medium transition-colors text-sm sm:text-base ${
            selectMode
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-white'
          }`}
        >
          {selectMode ? 'Exit Select Mode' : 'Select Mode'}
        </button>

        {selectMode && (
          <>
            <button
              onClick={selectAll}
              className="px-4 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
            >
              Select All ({drawings.length})
            </button>

            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={deselectAll}
                  className="px-4 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
                >
                  Deselect All
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 min-h-[44px] bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm sm:text-base flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Selected ({selectedIds.size})
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {drawings.map((drawing) => (
          <div key={drawing.id} className="relative">
            {selectMode && (
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedIds.has(drawing.id)}
                  onChange={() => toggleDrawingSelection(drawing.id)}
                  className="w-6 h-6 rounded border-2 border-slate-600 bg-slate-800 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  aria-label={`Select ${drawing.part_number}`}
                />
              </div>
            )}
            <DrawingCard
              key={drawing.id}
              drawing={drawing}
              onView={() => !selectMode && setSelectedDrawing(drawing)}
              onDownload={() => handleDownload(drawing)}
              showCompletionStatus={!selectMode}
              onStatusChange={() => fetchDrawings(false)}
            />
          </div>
        ))}
      </div>

      {/* Drawing Detail Modal */}
      {selectedDrawing && (
        <DrawingDetailModal
          drawing={selectedDrawing}
          onClose={() => setSelectedDrawing(null)}
          onDownload={() => handleDownload(selectedDrawing)}
          onDelete={() => handleDelete(selectedDrawing)}
        />
      )}
    </>
  )
}

// Drawing Detail Modal Component
function DrawingDetailModal({ drawing, onClose, onDownload, onDelete }) {
  const [fileUrl, setFileUrl] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [previewError, setPreviewError] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [customers, setCustomers] = useState([])
  const [projects, setProjects] = useState([])
  const [editedData, setEditedData] = useState({
    part_number: drawing.part_number,
    revision: drawing.revision || 'A',
    title: drawing.title || '',
    description: drawing.description || '',
    customer_name: drawing.customer_name || '',
    project_name: drawing.project_name || '',
    notes: drawing.notes || ''
  })

  // Inline note editing state (for quick add without full edit mode)
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteText, setNoteText] = useState(drawing.notes || '')

  // Customer and Project creation state
  const [newCustomerName, setNewCustomerName] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectNumber, setNewProjectNumber] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)

  // Zoom and pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Content dimensions for fit-to-view calculation
  const [contentDimensions, setContentDimensions] = useState(null)
  const previewContainerRef = useRef(null)

  useEffect(() => {
    const fetchFileUrl = async () => {
      if (!drawing.file_url) {
        const errorMsg = 'No file_url in database. This drawing may be from an older version.'
        console.error('❌', errorMsg)
        setPreviewError(errorMsg)
        setLoadingPreview(false)
        return
      }

      console.log('🔍 Attempting to generate signed URL for:', drawing.file_url)

      try {
        const { data, error } = await supabase.storage
          .from('drawings')
          .createSignedUrl(drawing.file_url, 3600)

        if (error) {
          console.error('❌ Signed URL generation failed:', error)
          console.error('   File path:', drawing.file_url)
          console.error('   Bucket:', 'drawings')
          console.error('   Error details:', error.message || error)
          setPreviewError(`Storage access error: ${error.message || 'Permission denied'}. Check Storage RLS policies.`)
        } else if (data) {
          console.log('✅ Signed URL generated successfully')
          console.log('   URL:', data.signedUrl)
          setFileUrl(data.signedUrl)
          setPreviewError(null)
        }
      } catch (error) {
        console.error('❌ Exception during signed URL generation:', error)
        setPreviewError(`Failed to access file: ${error.message}`)
      } finally {
        setLoadingPreview(false)
      }
    }

    fetchFileUrl()
  }, [drawing.file_url])

  useEffect(() => {
    const fetchCustomersAndProjects = async () => {
      if (!isEditing) return

      try {
        // Fetch all customers
        const { data: customersData } = await supabase
          .from('customers')
          .select('id, name')
          .order('name')

        if (customersData) setCustomers(customersData)

        // Fetch all projects (not filtered by customer)
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id, name, project_number')
          .order('name')

        if (projectsData) setProjects(projectsData)
      } catch (error) {
        console.error('Error fetching options:', error)
      }
    }

    fetchCustomersAndProjects()
  }, [isEditing])

  const handleSaveEdit = async () => {
    try {
      // Only send fields that exist in the database schema
      const updateData = {
        part_number: editedData.part_number,
        revision: editedData.revision,
        title: editedData.title,
        description: editedData.description,
        customer_name: editedData.customer_name || null,
        project_name: editedData.project_name || null,
        notes: editedData.notes || null
      }

      const { error } = await supabase
        .from('drawings')
        .update(updateData)
        .eq('id', drawing.id)

      if (error) throw error

      alert('Drawing updated successfully!')
      setIsEditing(false)
      onClose() // Close modal; real-time subscription will refresh the grid
    } catch (error) {
      console.error('Error updating drawing:', error)
      alert('Error updating drawing: ' + error.message)
    }
  }

  const handleSaveNote = async () => {
    try {
      const { error } = await supabase
        .from('drawings')
        .update({ notes: noteText || null })
        .eq('id', drawing.id)

      if (error) throw error

      setIsEditingNote(false)
      // Update drawing object in-place for immediate UI feedback
      drawing.notes = noteText || null
    } catch (error) {
      console.error('Error saving note:', error)
      alert('Error saving note: ' + error.message)
    }
  }

  const createCustomer = async () => {
    if (!newCustomerName.trim()) {
      alert('Customer name is required')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ name: newCustomerName }])
        .select()
        .single()

      if (error) throw error

      if (data) {
        setCustomers([...customers, data])
        setEditedData({ ...editedData, customer_name: data.name })
        setShowNewCustomer(false)
        setNewCustomerName('')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Error creating customer: ' + error.message)
    }
  }

  const createProject = async () => {
    if (!newProjectName.trim()) {
      alert('Project name is required')
      return
    }

    if (!editedData.customer_name) {
      alert('Please select a customer first')
      return
    }

    try {
      // Find the customer ID from the customer name
      const customer = customers.find(c => c.name === editedData.customer_name)
      if (!customer) {
        alert('Selected customer not found')
        return
      }

      const { data, error } = await supabase
        .from('projects')
        .insert([{
          name: newProjectName,
          project_number: newProjectNumber || null,
          customer_id: customer.id
        }])
        .select()
        .single()

      if (error) throw error

      if (data) {
        setProjects([...projects, data])
        setEditedData({ ...editedData, project_name: data.name })
        setShowNewProject(false)
        setNewProjectName('')
        setNewProjectNumber('')
      }
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Error creating project: ' + error.message)
    }
  }

  // Calculate fit scale based on container and content dimensions
  const calculateFitScale = () => {
    if (!previewContainerRef.current || !contentDimensions) {
      return 1
    }

    const container = previewContainerRef.current.getBoundingClientRect()

    // Account for padding (p-4 sm:p-8 = 16px / 32px padding on each side)
    const isMobile = window.innerWidth < 640
    const padding = isMobile ? 16 * 2 : 32 * 2

    const containerWidth = container.width - padding
    const containerHeight = container.height - padding

    const { width: contentWidth, height: contentHeight } = contentDimensions

    // Calculate scale ratios for both dimensions
    const widthRatio = containerWidth / contentWidth
    const heightRatio = containerHeight / contentHeight

    // Use the smaller ratio to ensure full content fits
    const fitScale = Math.min(widthRatio, heightRatio)

    // Clamp to zoom bounds (0.25 - 5x)
    return Math.max(0.25, Math.min(5, fitScale))
  }

  // Zoom and pan handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 5))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25))
  }

  const handleResetZoom = () => {
    // Use calculateFitScale instead of hardcoding zoom=1
    const fitScale = calculateFitScale()
    setZoom(fitScale)
    setPan({ x: 0, y: 0 })
  }

  const handleWheel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(0.25, Math.min(5, prev + delta)))
  }

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y
      })
    }
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const renderPreview = () => {
    if (loadingPreview) {
      return (
        <div className="py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-slate-400 mt-4">Loading preview...</p>
        </div>
      )
    }

    // Show error if preview failed to load
    if (previewError) {
      return (
        <div className="py-12 space-y-4">
          <svg className="w-16 h-16 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-400 font-medium mt-4">Failed to load preview</p>
          <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">{previewError}</p>
          <div className="mt-4 text-xs text-slate-500 bg-slate-950 rounded p-3 max-w-md mx-auto text-left font-mono">
            <div><strong>File:</strong> {drawing.file_url || 'N/A'}</div>
            <div><strong>Type:</strong> {drawing.file_type || 'N/A'}</div>
            <div><strong>Size:</strong> {formatFileSize(drawing.file_size)}</div>
          </div>

          {/* Graceful fallback - allow viewing PDF in new tab or iframe */}
          {fileUrl && drawing.file_type?.toLowerCase() === 'pdf' && (
            <div className="mt-6 space-y-3">
              <p className="text-slate-300 text-sm">Try viewing the PDF using an alternative method:</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => window.open(fileUrl, '_blank')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Tab
                </button>
                <button
                  onClick={onDownload}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }

    const fileType = drawing.file_type?.toLowerCase()

    // PDF Preview
    if (fileType === 'pdf' && fileUrl) {
      // Calculate dynamic width based on container
      // Use container width if available, otherwise use responsive defaults
      const containerWidth = previewContainerRef.current
        ? previewContainerRef.current.getBoundingClientRect().width
        : window.innerWidth

      const isMobile = window.innerWidth < 640
      const padding = isMobile ? 16 * 2 : 32 * 2
      const maxPdfWidth = containerWidth - padding

      // Use a reasonable max width for PDFs (not too large)
      const pdfWidth = Math.min(maxPdfWidth, 1200)

      return (
        <div
          className="flex flex-col items-center w-full max-w-full"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
        >
          <Document
            file={fileUrl}
            onLoadSuccess={(pdf) => {
              setNumPages(pdf.numPages)
              // Get the first page to calculate dimensions
              pdf.getPage(1).then((page) => {
                const viewport = page.getViewport({ scale: 1 })
                // Calculate actual rendered dimensions based on pdfWidth
                const scale = pdfWidth / viewport.width
                const renderedWidth = pdfWidth
                const renderedHeight = viewport.height * scale

                setContentDimensions({
                  width: renderedWidth,
                  height: renderedHeight
                })

                // Auto-fit on load
                setTimeout(() => {
                  const fitScale = calculateFitScale()
                  setZoom(fitScale)
                  setPan({ x: 0, y: 0 })
                }, 100)
              })
            }}
            onLoadError={(error) => {
              console.error('PDF load error:', error)
              setPreviewError(error?.message || 'Failed to load PDF file')
            }}
            loading={
              <div className="py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            }
          >
            <Page
              pageNumber={1}
              width={pdfWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
          {numPages && numPages > 1 && (
            <p className="text-slate-400 text-sm mt-2">Page 1 of {numPages}</p>
          )}
        </div>
      )
    }

    // Image Preview - support all common image formats
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif'].includes(fileType) && fileUrl) {
      return (
        <img
          src={fileUrl}
          alt={drawing.part_number}
          className="max-w-full mx-auto rounded object-contain"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
          onLoad={(e) => {
            // Capture natural dimensions for fit calculation
            const img = e.target
            setContentDimensions({
              width: img.naturalWidth,
              height: img.naturalHeight
            })

            // Auto-fit on load
            setTimeout(() => {
              const fitScale = calculateFitScale()
              setZoom(fitScale)
              setPan({ x: 0, y: 0 })
            }, 100)
          }}
          onError={(e) => {
            console.error('Failed to load image:', drawing.file_url)
            setPreviewError(`Failed to load image: ${drawing.file_type}`)
          }}
        />
      )
    }

    // Excel file - show icon with download prompt
    if (['xlsx', 'xls'].includes(fileType)) {
      return (
        <div className="py-12">
          <svg className="w-24 h-24 mx-auto text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M9 4v16M15 4v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
          </svg>
          <p className="text-white font-medium mt-4">{drawing.file_name}</p>
          <p className="text-slate-400 text-sm mt-2">Excel spreadsheets can't be previewed in the browser</p>
          <button
            onClick={onDownload}
            className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download to Open in Excel
          </button>
        </div>
      )
    }

    // No preview available
    return (
      <div className="py-12">
        <svg className="w-24 h-24 mx-auto text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-slate-400 mt-4">Preview not available</p>
        <p className="text-slate-500 text-sm mt-2">{fileType?.toUpperCase()} files require specialized viewers</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between p-4 sm:p-6 border-b border-slate-700 flex-shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">{drawing.part_number}</h2>
            <p className="text-slate-400 text-sm sm:text-base mt-1 truncate">{drawing.title || 'No title'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 -m-2 p-2"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {/* File Preview */}
          <div className="relative">
            {/* Zoom Controls */}
            <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10 flex flex-col gap-1 sm:gap-2">
              <div className="flex gap-1 sm:gap-2 bg-slate-800/90 rounded-lg p-1 sm:p-2 border border-slate-700">
                <button
                  onClick={handleZoomOut}
                  className="px-2 sm:px-3 py-2 min-h-[44px] min-w-[44px] bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors flex items-center justify-center"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-2 sm:px-3 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-sm font-medium whitespace-nowrap"
                  title="Reset Zoom"
                  aria-label="Reset Zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="px-2 sm:px-3 py-2 min-h-[44px] min-w-[44px] bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors flex items-center justify-center"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </button>
              </div>
              <button
                onClick={handleResetZoom}
                className="px-3 py-2 min-h-[44px] bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium border border-slate-700 whitespace-nowrap"
                title="Fit to view"
                aria-label="Fit to view"
              >
                Fit to View
              </button>
            </div>

            {/* Preview Container */}
            <div
              ref={previewContainerRef}
              className="bg-slate-900 rounded-lg p-4 sm:p-8 text-center overflow-hidden min-h-[300px] max-h-[50vh] lg:max-h-[70vh] flex items-center justify-center max-w-full"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ overscrollBehavior: 'contain' }}
            >
              {renderPreview()}
            </div>
          </div>

          {/* Details Grid / Edit Form */}
          {!isEditing ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Part Number" value={drawing.part_number} />
                <DetailItem label="Revision" value={drawing.revision || 'A'} />
                <DetailItem label="Customer" value={drawing.customer_name || 'N/A'} />
                <DetailItem label="Project" value={drawing.project_name || 'N/A'} />
                <DetailItem label="File Type" value={drawing.file_type?.toUpperCase()} />
                <DetailItem label="File Size" value={formatFileSize(drawing.file_size)} />
                <DetailItem label="Version" value={`v${drawing.version_number}`} />
                <DetailItem label="Status" value={drawing.status} />
                <DetailItem label="Uploaded" value={formatDate(drawing.created_at)} />
              </div>

              {/* Description */}
              {drawing.description && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Description</h3>
                  <p className="text-white bg-slate-900 rounded-lg p-3">{drawing.description}</p>
                </div>
              )}

              {/* AI Analysis */}
              {drawing.ai_description && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">AI Analysis</h3>
                  <p className="text-white bg-slate-900 rounded-lg p-3">{drawing.ai_description}</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-400 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Notes
                  </h3>
                  {!isEditingNote && (
                    <button
                      onClick={() => setIsEditingNote(true)}
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      {drawing.notes ? 'Edit Note' : '+ Add Note'}
                    </button>
                  )}
                </div>
                {isEditingNote ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Add a note or comment..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNote}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                      >
                        Save Note
                      </button>
                      <button
                        onClick={() => { setIsEditingNote(false); setNoteText(drawing.notes || '') }}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : drawing.notes ? (
                  <p className="text-white bg-slate-900 rounded-lg p-3">{drawing.notes}</p>
                ) : (
                  <p className="text-slate-500 text-sm italic">No notes added yet.</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Part Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Part Number</label>
                  <input
                    type="text"
                    value={editedData.part_number}
                    onChange={(e) => setEditedData({...editedData, part_number: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Revision */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Revision</label>
                  <input
                    type="text"
                    value={editedData.revision}
                    onChange={(e) => setEditedData({...editedData, revision: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Customer */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Customer</label>
                  {showNewCustomer ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Customer name"
                      />
                      <button
                        onClick={createCustomer}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowNewCustomer(false)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={editedData.customer_name}
                        onChange={(e) => setEditedData({...editedData, customer_name: e.target.value, project_name: ''})}
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Customer</option>
                        {customers.map(customer => (
                          <option key={customer.id} value={customer.name}>{customer.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowNewCustomer(true)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
                        title="Add new customer"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>

                {/* Project */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Project</label>
                  {showNewProject ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Project name *"
                        />
                        <input
                          type="text"
                          value={newProjectNumber}
                          onChange={(e) => setNewProjectNumber(e.target.value)}
                          className="w-28 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Number"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={createProject}
                          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                        >
                          Add Project
                        </button>
                        <button
                          onClick={() => setShowNewProject(false)}
                          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={editedData.project_name}
                        onChange={(e) => setEditedData({...editedData, project_name: e.target.value})}
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!editedData.customer_name}
                      >
                        <option value="">Select Project</option>
                        {projects.map(project => (
                          <option key={project.id} value={project.name}>
                            {project.project_number} - {project.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowNewProject(true)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
                        title="Add new project"
                        disabled={!editedData.customer_name}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value={editedData.title}
                  onChange={(e) => setEditedData({...editedData, title: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  value={editedData.description}
                  onChange={(e) => setEditedData({...editedData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
                <textarea
                  value={editedData.notes}
                  onChange={(e) => setEditedData({...editedData, notes: e.target.value})}
                  rows={3}
                  placeholder="Add notes or comments..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {!isEditing ? (
              <>
                <button
                  onClick={onDownload}
                  className="flex-1 px-4 py-3 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 sm:flex-initial px-4 py-3 min-h-[44px] bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={onDelete}
                    className="flex-1 sm:flex-initial px-4 py-3 min-h-[44px] bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-3 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white text-sm sm:text-base rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-3 min-h-[44px] bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base rounded-lg font-medium transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-3 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white text-sm sm:text-base rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-white font-medium mt-1">{value || 'N/A'}</p>
    </div>
  )
}

function formatFileSize(bytes) {
  if (!bytes) return 'N/A'
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString()
}
