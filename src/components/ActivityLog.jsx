import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function ActivityLog() {
  const toast = useToast()
  const { profile } = useAuth()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [timeRange, setTimeRange] = useState('7days')

  useEffect(() => {
    fetchActivities()
  }, [filterType, timeRange])

  const fetchActivities = async () => {
    setLoading(true)
    try {
      // Step 1: Fetch activities
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      // Apply time range filter
      const now = new Date()
      if (timeRange === '24hours') {
        const yesterday = new Date(now - 24 * 60 * 60 * 1000)
        query = query.gte('created_at', yesterday.toISOString())
      } else if (timeRange === '7days') {
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
        query = query.gte('created_at', weekAgo.toISOString())
      } else if (timeRange === '30days') {
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
        query = query.gte('created_at', monthAgo.toISOString())
      }

      // Apply activity type filter
      if (filterType !== 'all') {
        query = query.eq('activity', filterType)
      }

      const { data: activitiesData, error: activitiesError } = await query

      if (activitiesError) throw activitiesError

      // Step 2: Extract unique IDs
      const userIds = [...new Set(activitiesData.map(a => a.user_id).filter(Boolean))]
      const drawingIds = [...new Set(activitiesData.map(a => a.drawing_id).filter(Boolean))]

      // Step 3: Fetch related users and drawings in parallel
      const [usersResult, drawingsResult] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
          : { data: [] },
        drawingIds.length > 0
          ? supabase.from('drawings').select('id, part_number, title').in('id', drawingIds)
          : { data: [] }
      ])

      if (usersResult.error) throw usersResult.error
      if (drawingsResult.error) throw drawingsResult.error

      // Step 4: Create lookup maps
      const usersMap = new Map(usersResult.data.map(u => [u.id, u]))
      const drawingsMap = new Map(drawingsResult.data.map(d => [d.id, d]))

      // Step 5: Merge data client-side
      const mergedActivities = activitiesData.map(activity => ({
        ...activity,
        user: usersMap.get(activity.user_id) || null,
        drawing: drawingsMap.get(activity.drawing_id) || null
      }))

      setActivities(mergedActivities)
    } catch (error) {
      console.error('Error fetching activity log:', error)
      toast.error('Error loading activity log: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'upload':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        )
      case 'download':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )
      case 'edit':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )
      case 'delete':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )
      case 'view':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )
      case 'share':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getActivityColor = (activityType) => {
    switch (activityType) {
      case 'upload':
        return 'text-green-400 bg-green-500/10'
      case 'download':
        return 'text-blue-400 bg-blue-500/10'
      case 'edit':
        return 'text-yellow-400 bg-yellow-500/10'
      case 'delete':
        return 'text-red-400 bg-red-500/10'
      case 'view':
        return 'text-slate-400 bg-slate-500/10'
      case 'share':
        return 'text-purple-400 bg-purple-500/10'
      default:
        return 'text-slate-400 bg-slate-500/10'
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`

    return date.toLocaleString()
  }

  const getActivityDescription = (activity) => {
    const userName = activity.user?.full_name || 'Unknown user'
    const drawingName = activity.drawing?.part_number || 'Unknown drawing'

    switch (activity.activity) {
      case 'upload':
        return `${userName} uploaded ${drawingName}`
      case 'download':
        return `${userName} downloaded ${drawingName}`
      case 'edit':
        return `${userName} edited ${drawingName}`
      case 'delete':
        return `${userName} deleted ${drawingName}`
      case 'view':
        return `${userName} viewed ${drawingName}`
      case 'share':
        return `${userName} shared ${drawingName}`
      default:
        return `${userName} performed an action on ${drawingName}`
    }
  }

  const isAdmin = profile?.role === 'admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Activity Log</h2>
          <p className="text-slate-400 text-sm mt-1">
            {isAdmin ? 'View all system activity' : 'View your activity history'}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Activity Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Activities</option>
            <option value="upload">Uploads</option>
            <option value="download">Downloads</option>
            <option value="edit">Edits</option>
            <option value="delete">Deletions</option>
            <option value="view">Views</option>
            <option value="share">Shares</option>
          </select>

          {/* Time Range Filter */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="24hours">Last 24 Hours</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      {activities.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {['upload', 'download', 'edit', 'delete', 'view', 'share'].map((type) => {
            const count = activities.filter((a) => a.activity === type).length
            return (
              <div key={type} className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${getActivityColor(type)}`}>
                    {getActivityIcon(type)}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{count}</p>
                    <p className="text-xs text-slate-400 capitalize">{type}s</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Activity List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        {activities.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-white">No activity found</h3>
            <p className="mt-2 text-slate-400">No activities match your current filters</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {activities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Activity Icon */}
                  <div className={`p-2 rounded-lg ${getActivityColor(activity.activity)}`}>
                    {getActivityIcon(activity.activity)}
                  </div>

                  {/* Activity Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">
                      {getActivityDescription(activity)}
                    </p>

                    {/* Additional Details */}
                    {activity.details && (
                      <div className="mt-1 text-sm text-slate-400">
                        {activity.details.file_name && (
                          <span>File: {activity.details.file_name}</span>
                        )}
                        {activity.details.old_version && activity.details.new_version && (
                          <span>Version {activity.details.old_version} → {activity.details.new_version}</span>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(activity.created_at)}
                    </p>
                  </div>

                  {/* Activity Type Badge */}
                  <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${getActivityColor(activity.activity)}`}>
                    {activity.activity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
