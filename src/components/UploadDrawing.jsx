import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { generateThumbnail } from '../utils/thumbnailGenerator'

export default function UploadDrawing({ onComplete }) {
  const toast = useToast()
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [customers, setCustomers] = useState([])
  const [projects, setProjects] = useState([])
  const [newCustomerName, setNewCustomerName] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectNumber, setNewProjectNumber] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    projectId: '',
    projectName: '',
    partNumber: '',
    revision: 'A',
    title: '',
    description: '',
  })

  useEffect(() => {
    fetchCustomers()
    fetchProjects(null)
  }, [])

  useEffect(() => {
    fetchProjects(formData.customerId || null)
  }, [formData.customerId])

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')

    if (!error && data) {
      setCustomers(data)
    }
  }

  const fetchProjects = async (customerId) => {
    let query = supabase
      .from('projects')
      .select('*')
      .order('name')

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    const { data, error } = await query

    if (!error && data) {
      setProjects(data)
    }
  }

  const createCustomer = async () => {
    if (!newCustomerName.trim()) return

    const { data, error } = await supabase
      .from('customers')
      .insert([{ name: newCustomerName }])
      .select()
      .single()

    if (!error && data) {
      setCustomers([...customers, data])
      setFormData({
        ...formData,
        customerId: data.id,
        customerName: data.name
      })
      setShowNewCustomer(false)
      setNewCustomerName('')
    }
  }

  const createProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Project name is required')
      return
    }

    if (!formData.customerId) {
      toast.error('Please select a customer first')
      return
    }

    const { data, error } = await supabase
      .from('projects')
      .insert([{
        name: newProjectName,
        project_number: newProjectNumber || null,
        customer_id: formData.customerId
      }])
      .select()
      .single()

    if (!error && data) {
      setProjects([...projects, data])
      setFormData({
        ...formData,
        projectId: data.id,
        projectName: data.name
      })
      setShowNewProject(false)
      setNewProjectName('')
      setNewProjectNumber('')
    } else {
      toast.error('Error creating project: ' + error.message)
    }
  }

  const onDrop = useCallback((acceptedFiles) => {
    setFiles(acceptedFiles.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    })))
  }, [])

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      files.forEach(fileObj => {
        if (fileObj.preview) {
          URL.revokeObjectURL(fileObj.preview)
        }
      })
    }
  }, [files])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/dwg': ['.dwg'],
      'application/acad': ['.dwg'],
      'application/x-dwg': ['.dwg'],
      'application/dxf': ['.dxf'],
      'application/x-dxf': ['.dxf'],
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxSize: 104857600, // 100MB
  })

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file')
      return
    }

    if (!formData.partNumber) {
      toast.error('Please enter a part number')
      return
    }

    setUploading(true)

    try {
      for (const fileObj of files) {
        const file = fileObj.file
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${file.name}`
        const filePath = `${fileName}`

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('drawings')
          .upload(filePath, file, {
            contentType: file.type
          })

        if (uploadError) throw uploadError

        // Generate and upload thumbnail for PDFs and images
        let thumbnailPath = null
        try {
          if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
            console.log('🖼️ Generating thumbnail for:', file.name, 'Type:', file.type)
            const thumbnailBlob = await generateThumbnail(file)
            console.log('✅ Thumbnail blob generated:', thumbnailBlob.size, 'bytes')

            const thumbnailFileName = `thumbnails/${Date.now()}-${file.name.replace(/\.[^/.]+$/, '')}.jpg`
            console.log('📤 Uploading thumbnail to:', thumbnailFileName)

            const { error: thumbError } = await supabase.storage
              .from('drawings')
              .upload(thumbnailFileName, thumbnailBlob, {
                contentType: 'image/jpeg'
              })

            if (!thumbError) {
              thumbnailPath = thumbnailFileName
              console.log('✅ Thumbnail uploaded successfully:', thumbnailPath)
            } else {
              console.error('❌ Thumbnail upload failed:', thumbError)
            }
          } else {
            console.log('⏭️ Skipping thumbnail generation for file type:', file.type)
          }
        } catch (thumbError) {
          console.error('❌ Failed to generate thumbnail:', thumbError)
          // Continue without thumbnail - not critical
        }

        // Create database entry - store filePath in file_url (not public URL)
        console.log('💾 Inserting drawing into database with thumbnail_url:', thumbnailPath)
        const { data: newDrawing, error: dbError } = await supabase
          .from('drawings')
          .insert([{
            part_number: formData.partNumber,
            revision: formData.revision,
            title: formData.title || null,
            description: formData.description || null,
            customer_name: formData.customerName || null,
            project_name: formData.projectName || null,
            file_name: file.name,
            file_type: fileExt,
            file_size: file.size,
            file_url: filePath,
            thumbnail_url: thumbnailPath,
            uploaded_by: user.id,
            status: 'active',
          }])
          .select()
          .single()

        if (dbError) throw dbError
        console.log('✅ Drawing saved to database. ID:', newDrawing.id, 'Thumbnail URL:', newDrawing.thumbnail_url)

        // Trigger AI analysis for supported file types
        if (['pdf', 'png', 'jpg', 'jpeg'].includes(fileExt.toLowerCase()) && newDrawing) {
          try {
            // Get signed URL for AI analysis
            const { data: signedData } = await supabase.storage
              .from('drawings')
              .createSignedUrl(filePath, 3600) // 1 hour expiry

            if (signedData?.signedUrl) {
              await fetch(import.meta.env.VITE_N8N_ANALYZE_DRAWING_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  drawing_id: newDrawing.id,
                  file_url: signedData.signedUrl,
                  file_name: file.name,
                  file_type: fileExt,
                })
              })
            }
          } catch (aiError) {
            // Don't fail upload if AI analysis fails
            console.warn('AI analysis failed:', aiError)
          }
        }
      }

      toast.success('Upload successful!')

      // Reset form
      setFiles([])
      setFormData({
        customerId: '',
        customerName: '',
        projectId: '',
        projectName: '',
        partNumber: '',
        revision: 'A',
        title: '',
        description: '',
      })

      if (onComplete) onComplete()

    } catch (error) {
      console.error('Error uploading:', error)
      toast.error('Error uploading files: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (index) => {
    // Revoke URL before removing
    const fileToRemove = files[index]
    if (fileToRemove?.preview) {
      URL.revokeObjectURL(fileToRemove.preview)
    }
    setFiles(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      {/* Drag & Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-600 bg-slate-900/50 hover:border-blue-500/50'
        }`}
      >
        <input {...getInputProps()} />
        <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {isDragActive ? (
          <p className="text-blue-400 font-medium">Drop files here...</p>
        ) : (
          <>
            <p className="text-white font-medium mb-2">Drag & drop files here, or click to select</p>
            <p className="text-slate-400 text-sm">Supports: DWG, DXF, PDF, PNG, JPG, XLSX (max 100MB)</p>
          </>
        )}
      </div>

      {/* Selected Files */}
      {files.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
          <h3 className="text-white font-medium mb-3">Selected Files ({files.length})</h3>
          {files.map((fileObj, index) => (
            <div key={index} className="flex items-center justify-between bg-slate-800 p-3 rounded">
              <div className="flex items-center gap-3">
                {fileObj.preview ? (
                  <img src={fileObj.preview} alt="" className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-slate-700 rounded flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="text-white font-medium">{fileObj.file.name}</p>
                  <p className="text-slate-400 text-sm">{(fileObj.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-slate-400 hover:text-red-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Part Number */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Part Number *
          </label>
          <input
            type="text"
            required
            value={formData.partNumber}
            onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="25179-001"
          />
        </div>

        {/* Revision */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Revision
          </label>
          <input
            type="text"
            value={formData.revision}
            onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="A"
          />
        </div>

        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Customer
          </label>
          {showNewCustomer ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Customer name"
              />
              <button
                onClick={createCustomer}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add
              </button>
              <button
                onClick={() => setShowNewCustomer(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={formData.customerId}
                onChange={(e) => {
                  const selected = customers.find(c => c.id === e.target.value)
                  setFormData({
                    ...formData,
                    customerId: e.target.value,
                    customerName: selected?.name || '',
                    projectId: '',
                    projectName: ''
                  })
                }}
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewCustomer(true)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
                title="Add new customer"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Project */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Project (Optional)
          </label>
          {showNewProject ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Project name *"
                />
                <input
                  type="text"
                  value={newProjectNumber}
                  onChange={(e) => setNewProjectNumber(e.target.value)}
                  className="w-32 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Number"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createProject}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Add Project
                </button>
                <button
                  onClick={() => setShowNewProject(false)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={formData.projectId}
                onChange={(e) => {
                  const selected = projects.find(p => p.id === e.target.value)
                  setFormData({
                    ...formData,
                    projectId: e.target.value,
                    projectName: selected?.name || ''
                  })
                }}
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} {project.project_number && `(${project.project_number})`}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewProject(true)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
                title="Add new project"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Title (Optional)
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Drawing title"
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Additional notes or description"
          />
        </div>
      </div>

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={uploading || files.length === 0}
        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
      >
        {uploading ? 'Uploading...' : `Upload ${files.length} Drawing${files.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
