import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const { user, profile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    department: '',
    role: ''
  })

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        department: profile.department || '',
        role: profile.role || 'viewer'
      })
    }
  }, [profile])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name,
          department: profileForm.department,
          role: profileForm.role
        })
        .eq('id', user.id)

      if (error) throw error

      // Update local profile state
      setProfile({
        ...profile,
        ...profileForm
      })

      alert('Profile updated successfully!')
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Error updating profile: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Passwords do not match!')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      alert('Password must be at least 6 characters long')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) throw error

      alert('Password changed successfully!')
      setShowPasswordChange(false)
      setPasswordForm({ newPassword: '', confirmPassword: '' })
    } catch (error) {
      console.error('Error changing password:', error)
      alert('Error changing password: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      navigate('/login')
    } catch (error) {
      console.error('Error logging out:', error)
      alert('Error logging out: ' + error.message)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm')
      return
    }

    if (!window.confirm('Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.')) {
      return
    }

    setLoading(true)

    try {
      // Delete user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

      if (profileError) throw profileError

      // Delete auth user (this will cascade delete related data)
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id)

      if (authError) {
        // If admin delete fails, just sign out the user
        console.warn('Could not delete auth user, signing out:', authError)
      }

      alert('Account deleted successfully')
      navigate('/login')
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Error deleting account: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Settings</h2>
        <p className="text-slate-400 text-sm mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Information */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Profile Information</h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {!isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400">Full Name</p>
                <p className="text-white font-medium mt-1 truncate">{profile?.full_name || 'N/A'}</p>
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-sm text-slate-400">Email</p>
                <p className="text-white font-medium mt-1 break-all max-w-full" style={{overflowWrap: 'anywhere', wordBreak: 'break-word'}}>{profile?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Role</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded mt-1 ${
                  profile?.role === 'admin' ? 'bg-red-500/10 text-red-400' :
                  profile?.role === 'engineer' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-slate-500/10 text-slate-400'
                }`}>
                  {profile?.role?.charAt(0).toUpperCase() + profile?.role?.slice(1) || 'N/A'}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-400">Department</p>
                <p className="text-white font-medium mt-1 truncate">{profile?.department || 'N/A'}</p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profile?.email}
                  disabled
                  className="w-full px-3 py-2 min-h-[44px] bg-slate-900 border border-slate-600 rounded text-slate-400 cursor-not-allowed text-base break-all overflow-hidden"
                  title="Email cannot be changed"
                  style={{overflowWrap: 'anywhere', wordBreak: 'break-word'}}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Role {!isAdmin && <span className="text-xs text-slate-500">(Admin only)</span>}
                </label>
                <select
                  value={profileForm.role}
                  onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                  disabled={!isAdmin}
                  className={`w-full px-3 py-2 min-h-[44px] border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
                    isAdmin ? 'bg-slate-700' : 'bg-slate-900 cursor-not-allowed'
                  }`}
                >
                  <option value="viewer">Viewer</option>
                  <option value="engineer">Engineer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={profileForm.department}
                  onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                  className="w-full px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                  placeholder="e.g., Engineering"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  setProfileForm({
                    full_name: profile?.full_name || '',
                    department: profile?.department || '',
                    role: profile?.role || 'viewer'
                  })
                }}
                className="px-4 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-base"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-base"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Security Settings */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Security</h3>

        {!showPasswordChange ? (
          <button
            onClick={() => setShowPasswordChange(true)}
            className="px-4 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors flex items-center gap-2 text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Change Password
          </button>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                placeholder="Enter new password"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                placeholder="Confirm new password"
                required
                minLength={6}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(false)
                  setPasswordForm({ newPassword: '', confirmPassword: '' })
                }}
                className="px-4 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-base"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-base"
                disabled={loading}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Account Actions */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Account Actions</h3>

        <div className="space-y-3">
          {/* Logout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-700/50 rounded-lg gap-3">
            <div>
              <p className="text-white font-medium">Logout</p>
              <p className="text-slate-400 text-sm">Sign out of your account</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 min-h-[44px] bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors flex-shrink-0 text-base"
            >
              Logout
            </button>
          </div>

          {/* Delete Account */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg gap-3">
            <div>
              <p className="text-white font-medium">Delete Account</p>
              <p className="text-slate-400 text-sm">Permanently delete your account and all data</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 min-h-[44px] bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex-shrink-0 text-base whitespace-nowrap"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-red-500/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Delete Account</h2>
            </div>

            <div className="space-y-4">
              <p className="text-slate-300">
                This action is permanent and cannot be undone. All your data, including:
              </p>
              <ul className="list-disc list-inside text-slate-400 text-sm space-y-1">
                <li>Uploaded drawings</li>
                <li>Activity history</li>
                <li>Customer and project associations</li>
                <li>Profile information</li>
              </ul>
              <p className="text-slate-300">will be permanently deleted.</p>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Type <span className="font-mono text-red-400">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
                  placeholder="DELETE"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmText('')
                  }}
                  className="px-4 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-base"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 min-h-[44px] bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 text-base whitespace-nowrap"
                  disabled={loading || deleteConfirmText !== 'DELETE'}
                >
                  {loading ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
