import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ConfirmModal from './ConfirmModal'

export default function CustomersProjects() {
  const { user, profile } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showAddProject, setShowAddProject] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [expandedCustomers, setExpandedCustomers] = useState(new Set())

  // Form state
  const [customerForm, setCustomerForm] = useState({ name: '', code: '', description: '' })
  const [projectForm, setProjectForm] = useState({ name: '', project_number: '', description: '' })
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editingProject, setEditingProject] = useState(null)

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          projects (*)
        `)
        .order('name')

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      alert('Error loading customers: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCustomer = async (e) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('customers')
        .insert([{
          ...customerForm,
          created_by: user.id
        }])

      if (error) throw error

      alert('Customer added successfully!')
      setShowAddCustomer(false)
      setCustomerForm({ name: '', code: '', description: '' })
      fetchCustomers()
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('Error adding customer: ' + error.message)
    }
  }

  const handleUpdateCustomer = async (e) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('customers')
        .update(customerForm)
        .eq('id', editingCustomer.id)

      if (error) throw error

      alert('Customer updated successfully!')
      setEditingCustomer(null)
      setCustomerForm({ name: '', code: '', description: '' })
      fetchCustomers()
    } catch (error) {
      console.error('Error updating customer:', error)
      alert('Error updating customer: ' + error.message)
    }
  }

  const handleDeleteCustomer = (customerId, customerName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Customer',
      message: `Are you sure you want to delete "${customerName}"? This will also delete all associated projects and may affect drawings. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const { data, error } = await supabase
            .from('customers')
            .delete()
            .eq('id', customerId)

          if (error) {
            console.error('Delete failed:', error)
            throw error
          }

          // Only update state after successful delete
          setCustomers(customers.filter(c => c.id !== customerId))
        } catch (error) {
          console.error('Error deleting customer:', error)
          alert('Failed to delete customer: ' + error.message + '\nPlease check the console for details.')
        }
      }
    })
  }

  const handleAddProject = async (e) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('projects')
        .insert([{
          ...projectForm,
          customer_id: selectedCustomer.id,
          created_by: user.id
        }])

      if (error) throw error

      alert('Project added successfully!')
      setShowAddProject(false)
      setProjectForm({ name: '', project_number: '', description: '' })
      setSelectedCustomer(null)
      fetchCustomers()
    } catch (error) {
      console.error('Error adding project:', error)
      alert('Error adding project: ' + error.message)
    }
  }

  const handleUpdateProject = async (e) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('projects')
        .update(projectForm)
        .eq('id', editingProject.id)

      if (error) throw error

      alert('Project updated successfully!')
      setEditingProject(null)
      setProjectForm({ name: '', project_number: '', description: '' })
      fetchCustomers()
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
          const { data, error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId)

          if (error) {
            console.error('Delete failed:', error)
            throw error
          }

          // Only update state after successful delete
          setCustomers(customers.map(customer => ({
            ...customer,
            projects: customer.projects?.filter(p => p.id !== projectId) || []
          })))
        } catch (error) {
          console.error('Error deleting project:', error)
          alert('Failed to delete project: ' + error.message + '\nPlease check the console for details.')
        }
      }
    })
  }

  const toggleCustomerExpanded = (customerId) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId)
    } else {
      newExpanded.add(customerId)
    }
    setExpandedCustomers(newExpanded)
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
          <h2 className="text-xl font-semibold text-white">Customers & Projects</h2>
          <p className="text-slate-400 text-sm mt-1">Manage your customer list and associated projects</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddCustomer(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Customer
          </button>
        )}
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {customers.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-white">No customers yet</h3>
            <p className="mt-2 text-slate-400">Get started by adding your first customer</p>
          </div>
        ) : (
          customers.map((customer) => (
            <div key={customer.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              {/* Customer Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleCustomerExpanded(customer.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <svg
                      className={`w-5 h-5 transition-transform ${expandedCustomers.has(customer.id) ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{customer.name}</h3>
                    {customer.code && (
                      <p className="text-slate-400 text-sm">Code: {customer.code}</p>
                    )}
                    {customer.description && (
                      <p className="text-slate-400 text-sm mt-1">{customer.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    {customer.projects?.length || 0} projects
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setShowAddProject(true)
                      }}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                      title="Add Project"
                    >
                      + Project
                    </button>
                    <button
                      onClick={() => {
                        setEditingCustomer(customer)
                        setCustomerForm({
                          name: customer.name,
                          code: customer.code || '',
                          description: customer.description || ''
                        })
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                      title="Edit Customer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                      title="Delete Customer"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Projects List */}
              {expandedCustomers.has(customer.id) && customer.projects && customer.projects.length > 0 && (
                <div className="border-t border-slate-700 bg-slate-900 p-4">
                  <div className="space-y-2">
                    {customer.projects.map((project) => (
                      <div
                        key={project.id}
                        className="bg-slate-800 rounded p-3 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{project.name}</span>
                            {project.project_number && (
                              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">
                                #{project.project_number}
                              </span>
                            )}
                          </div>
                          {project.description && (
                            <p className="text-slate-400 text-sm mt-1">{project.description}</p>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => {
                                setEditingProject(project)
                                setProjectForm({
                                  name: project.name,
                                  project_number: project.project_number || '',
                                  description: project.description || ''
                                })
                              }}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProject(project.id, project.name)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {(showAddCustomer || editingCustomer) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            <form onSubmit={editingCustomer ? handleUpdateCustomer : handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Acme Corporation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Customer Code (Optional)
                </label>
                <input
                  type="text"
                  value={customerForm.code}
                  onChange={(e) => setCustomerForm({ ...customerForm, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., ACME"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={customerForm.description}
                  onChange={(e) => setCustomerForm({ ...customerForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes about this customer..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomer(false)
                    setEditingCustomer(null)
                    setCustomerForm({ name: '', code: '', description: '' })
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  {editingCustomer ? 'Update' : 'Add'} Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Project Modal */}
      {(showAddProject || editingProject) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingProject ? 'Edit Project' : `Add Project to ${selectedCustomer?.name}`}
            </h2>
            <form onSubmit={editingProject ? handleUpdateProject : handleAddProject} className="space-y-4">
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
                    setProjectForm({ name: '', project_number: '', description: '' })
                    setSelectedCustomer(null)
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
