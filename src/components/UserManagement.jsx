import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function UserManagement() {
  const toast = useToast()
  const { profile } = useAuth()
  const [allowedUsers, setAllowedUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserNotes, setNewUserNotes] = useState('')

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchAllowedUsers()
    }
  }, [profile])

  const fetchAllowedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_access_summary')
        .select('*')
        .order('added_at', { ascending: false })

      if (error) throw error
      setAllowedUsers(data || [])
    } catch (error) {
      console.error('Error fetching allowed users:', error)
      toast.error('Error loading users: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault()

    if (!newUserEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newUserEmail)) {
      toast.error('Please enter a valid email address')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('allowed_users')
        .insert([{
          email: newUserEmail.toLowerCase().trim(),
          notes: newUserNotes.trim() || null,
          allowed_by: user.id
        }])

      if (error) {
        if (error.code === '23505') { // Unique violation
          toast.error('This email is already in the allowed users list')
        } else {
          throw error
        }
        return
      }

      toast.success('User added successfully!')
      setShowAddUser(false)
      setNewUserEmail('')
      setNewUserNotes('')
      fetchAllowedUsers()
    } catch (error) {
      console.error('Error adding user:', error)
      toast.error('Error adding user: ' + error.message)
    }
  }

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('allowed_users')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      fetchAllowedUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Error updating user: ' + error.message)
    }
  }

  const handleRemoveUser = async (userId, email) => {
    if (!window.confirm(`Remove ${email} from allowed users?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('allowed_users')
        .delete()
        .eq('id', userId)

      if (error) throw error

      toast.success('User removed successfully!')
      fetchAllowedUsers()
    } catch (error) {
      console.error('Error removing user:', error)
      toast.error('Error removing user: ' + error.message)
    }
  }

  // Only admins can access this
  if (profile?.role !== 'admin') {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">Access Denied</h3>
        <p className="mt-2 text-slate-400">Only administrators can manage user access</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">User Access Control</h2>
          <p className="text-slate-400 text-sm mt-1">Manage who can access the system</p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-slate-400 text-sm">Total Allowed</div>
          <div className="text-2xl font-bold text-white mt-1">{allowedUsers.length}</div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-slate-400 text-sm">Registered</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {allowedUsers.filter(u => u.status === 'Registered').length}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-slate-400 text-sm">Active</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            {allowedUsers.filter(u => u.is_active).length}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Active
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Added
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {allowedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-750">
                  <td className="px-4 py-3 text-sm text-white">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.status === 'Registered'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className={`px-2 py-1 rounded text-xs ${
                        user.is_active
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {new Date(user.added_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {user.notes || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button
                      onClick={() => handleRemoveUser(user.id, user.email)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">Add Allowed User</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={newUserNotes}
                  onChange={(e) => setNewUserNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Department, role, or other notes..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUser(false)
                    setNewUserEmail('')
                    setNewUserNotes('')
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
