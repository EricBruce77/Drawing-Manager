import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import UpdateRequestModal from './UpdateRequestModal'
import { normalizeThumb } from '../utils/urlHelpers'

export default function DrawingCard({ drawing, onView, onDownload, showCompletionStatus = false, onStatusChange }) {
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const handleMarkComplete = async (e) => {
    e.stopPropagation()

    const newStatus = drawing.completion_status === 'completed' ? 'pending' : 'completed'

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('drawings')
        .update({
          completion_status: newStatus,
          completed_by: newStatus === 'completed' ? user.id : null,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', drawing.id)

      if (error) throw error

      // Trigger refresh if callback provided
      if (onStatusChange) onStatusChange()
    } catch (error) {
      console.error('Error updating completion status:', error)
      alert('Error updating status: ' + error.message)
    }
  }

  const getCompletionBadge = () => {
    if (!showCompletionStatus) return null

    const badges = {
      pending: { color: 'bg-slate-600 text-slate-300', icon: '○', text: 'Pending' },
      in_progress: { color: 'bg-yellow-600 text-white', icon: '⟳', text: 'In Progress' },
      completed: { color: 'bg-green-600 text-white', icon: '✓', text: 'Complete' }
    }

    const badge = badges[drawing.completion_status || 'pending']

    return (
      <div className={`absolute top-2 right-2 px-2 py-1 ${badge.color} text-xs font-medium rounded flex items-center gap-1 shadow-lg`}>
        <span>{badge.icon}</span>
        <span>{badge.text}</span>
      </div>
    )
  }

  const getUpdateBadge = () => {
    if (!drawing.needs_update) return null

    return (
      <div className="absolute top-2 left-2 px-2 py-1 bg-orange-600 text-white text-xs font-medium rounded flex items-center gap-1 shadow-lg"
           title={drawing.update_description || 'Update needed'}>
        <span>⚠</span>
        <span>Update Needed</span>
      </div>
    )
  }

  const getFileIcon = (fileType) => {
    switch (fileType?.toLowerCase()) {
      case 'dwg':
      case 'dxf':
        return (
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case 'pdf':
        return (
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        )
      default:
        return (
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
    }
  }

  return (
    <>
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-blue-500 transition-colors group">
        {/* Thumbnail/Icon */}
        <div className="aspect-[4/3] bg-slate-900 flex items-center justify-center cursor-pointer relative" onClick={onView}>
          {normalizeThumb(drawing.thumbnail_url) ? (
            <img
              src={normalizeThumb(drawing.thumbnail_url)}
              alt={drawing.part_number}
              className="w-full h-full object-contain bg-slate-800"
            />
          ) : (
            getFileIcon(drawing.file_type)
          )}
          {getUpdateBadge()}
          {getCompletionBadge()}
        </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate cursor-pointer hover:text-blue-400" onClick={onView}>
              {drawing.part_number}
            </h3>
            {drawing.title && (
              <p className="text-slate-400 text-sm truncate mt-1">{drawing.title}</p>
            )}
          </div>
          <span className="ml-2 px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded uppercase flex-shrink-0">
            {drawing.file_type}
          </span>
        </div>

        {/* Customer/Project */}
        {drawing.customer_name && (
          <p className="text-slate-400 text-sm truncate mb-3">
            {drawing.customer_name}
            {drawing.project_name && ` • ${drawing.project_name}`}
          </p>
        )}

        {/* AI Tags */}
        {drawing.ai_tags && drawing.ai_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {drawing.ai_tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded">
                {tag}
              </span>
            ))}
            {drawing.ai_tags.length > 3 && (
              <span className="px-2 py-1 bg-slate-700 text-slate-400 text-xs rounded">
                +{drawing.ai_tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Update Description */}
        {drawing.needs_update && drawing.update_description && (
          <div className="mb-3 p-2 bg-orange-500/10 border border-orange-500/20 rounded text-sm text-orange-400">
            <span className="font-semibold">Update needed:</span> {drawing.update_description}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onView}
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
          >
            View
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowUpdateModal(true)
            }}
            className={`px-3 py-2 text-white text-sm rounded transition-colors ${
              drawing.needs_update
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-slate-600 hover:bg-slate-500'
            }`}
            title={drawing.needs_update ? 'View Update Request' : 'Request Update'}
          >
            {drawing.needs_update ? '⚠' : '⟳'}
          </button>
          {showCompletionStatus && (
            <button
              onClick={handleMarkComplete}
              className={`px-3 py-2 text-white text-sm rounded transition-colors ${
                drawing.completion_status === 'completed'
                  ? 'bg-slate-600 hover:bg-slate-500'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              title={drawing.completion_status === 'completed' ? 'Mark as Pending' : 'Mark Complete'}
            >
              {drawing.completion_status === 'completed' ? '↶' : '✓'}
            </button>
          )}
          <button
            onClick={onDownload}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <UpdateRequestModal
      drawing={drawing}
      isOpen={showUpdateModal}
      onClose={() => setShowUpdateModal(false)}
      onSuccess={onStatusChange}
    />
  </>
  )
}