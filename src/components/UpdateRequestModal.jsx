import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function UpdateRequestModal({ drawing, isOpen, onClose, onSuccess }) {
  const toast = useToast()
  const { user } = useAuth()
  const [description, setDescription] = useState(drawing?.update_description || '')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('drawings')
        .update({
          needs_update: true,
          update_description: description,
          update_requested_at: new Date().toISOString(),
          update_requested_by: user.id
        })
        .eq('id', drawing.id)

      if (error) throw error

      console.log('✅ Drawing marked for update:', drawing.id)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('❌ Error marking drawing for update:', error)
      toast.error('Failed to mark drawing for update: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearUpdate = async () => {
    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('drawings')
        .update({
          needs_update: false,
          update_description: null,
          update_requested_at: null,
          update_requested_by: null
        })
        .eq('id', drawing.id)

      if (error) throw error

      console.log('✅ Update request cleared:', drawing.id)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('❌ Error clearing update request:', error)
      toast.error('Failed to clear update request: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">
          {drawing?.needs_update ? 'Update Request' : 'Request Update'}
        </h2>

        <p className="text-gray-600 mb-4">
          Drawing: <span className="font-semibold">{drawing?.part_number}</span>
          {drawing?.revision && <span className="text-sm"> Rev {drawing.revision}</span>}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Update Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs to be updated..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="4"
              disabled={submitting}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
              disabled={submitting}
            >
              Cancel
            </button>

            {drawing?.needs_update && (
              <button
                type="button"
                onClick={handleClearUpdate}
                className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Clearing...' : 'Clear Request'}
              </button>
            )}

            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : drawing?.needs_update ? 'Update Description' : 'Mark for Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
