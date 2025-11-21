import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ConfirmModal from './ConfirmModal'

export default function Projects() {
  const { user, profile } = useAuth()
  const [projects, setProjects] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddProject, setShowAddProject] = useState(false)
  const [editingProject, setEditingProject] = useState(null)

  // Form state
  const [projectForm, setProjectForm] = useState({
    name: '',
    project_number: '',
    description: '',
    customer_id: ''
  })

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  useEffect(() => {
    fetchProjects()
    fetchCustomers()
  }, [])

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          customer:customers(id, name)
        `)
        .order('name')

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
      alert('Error loading projects: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name')

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const handleAddProject = async (e) => {
    e.preventDefault()

    if (!projectForm.customer_id) {
      alert('Please select a customer')
      return
    }

    try {
      const { error } = await supabase
        .from('projects')
        .insert([{
          name: projectForm.name,
          project_number: projectForm.project_number || null,
          description: projectForm.description || null,
          customer_id: projectForm.customer_id,
          created_by: user.id
        }])

      if (error) throw error

      alert('Project added successfully!')
      setShowAddProject(false)
      setProjectForm({ name: '', project_number: '', description: '', customer_id: '' })
      fetchProjects()
    } catch (error) {
      console.error('Error adding project:', error)
      alert('Error adding project: ' + error.message)
    }
  }

  const handleUpdateProject = async (e) => {
    e.preventDefault()

    if (!projectForm.customer_id) {
      alert('Please select a customer')
      return
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: projectForm.name,
          project_number: projectForm.project_number || null,
          description: projectForm.description || null,
          customer_id: projectForm.customer_id
        })
        .eq('id', editingProject.id)

      if (error) throw error

      alert('Project updated successfully!')
      setEditingProject(null)
      setProjectForm({ name: '', project_number: '', description: '', customer_id: '' })
      fetchProjects()
    } catch (error) {
      console.error('Error updating project:', error)
      alert('Error updating project: ' + error.message)
    }
  }

  const handleDeleteProject = (projectId, projectName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Project',
      message: `Are you sure you want to delete "${projectName}"? This may affect associated drawings. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const { data, error} = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId)

          if (error) {
            console.error('Delete failed:', error)
            throw error
          }

          // Only update state after successful delete
          setProjects(projects.filter(p => p.id !== projectId))
        } catch (error) {
          console.error('Error deleting project:', error)
          alert('Failed to delete project: ' + error.message + '\nPlease check the console for details.')
        }
      }
    })
  }

  const canEdit = profile?.role === 'admin' || profile?.role === 'engineer' || profile?.role === 'viewer'

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
          <h2 className="text-xl font-semibold text-white">Projects</h2>
          <p className="text-slate-400 text-sm mt-1">Manage your project list</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddProject(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Project
          </button>
        )}
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-full bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-white">No projects yet</h3>
            <p className="mt-2 text-slate-400">Get started by adding your first project</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-blue-500 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{project.name}</h3>
                  {project.project_number && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">
                      #{project.project_number}
                    </span>
                  )}
                </div>
              </div>

              {/* Customer */}
              <div className="mb-3">
                <span className="text-slate-400 text-sm">Customer:</span>
                <p className="text-white text-sm font-medium">{project.customer?.name || 'N/A'}</p>
              </div>

              {/* Description */}
              {project.description && (
                <p className="text-slate-400 text-sm mb-3 line-clamp-2">{project.description}</p>
              )}

              {/* Actions */}
              {canEdit && (
                <div className="flex gap-2 pt-3 border-t border-slate-700">
                  <button
                    onClick={() => {
                      setEditingProject(project)
                      setProjectForm({
                        name: project.name,
                        project_number: project.project_number || '',
                        description: project.description || '',
                        customer_id: project.customer_id
                      })
                    }}
                    className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project.id, project.name)}
                    className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Project Modal */}
      {(showAddProject || editingProject) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingProject ? 'Edit Project' : 'Add New Project'}
            </h2>
            <form onSubmit={editingProject ? handleUpdateProject : handleAddProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Customer *
                </label>
                <select
                  required
                  value={projectForm.customer_id}
                  onChange={(e) => setProjectForm({ ...projectForm, customer_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., New Facility Construction"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Project Number (Optional)
                </label>
                <input
                  type="text"
                  value={projectForm.project_number}
                  onChange={(e) => setProjectForm({ ...projectForm, project_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 25179"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes about this project..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProject(false)
                    setEditingProject(null)
                    setProjectForm({ name: '', project_number: '', description: '', customer_id: '' })
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  {editingProject ? 'Update' : 'Add'} Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  )
}
