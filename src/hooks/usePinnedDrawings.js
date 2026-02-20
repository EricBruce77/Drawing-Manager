import { useState, useCallback } from 'react'

const STORAGE_KEY = 'pinned-drawings'

function loadPinned() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function usePinnedDrawings() {
  const [pinnedIds, setPinnedIds] = useState(loadPinned)

  const togglePin = useCallback((id) => {
    setPinnedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const isPinned = useCallback((id) => pinnedIds.has(id), [pinnedIds])

  return { pinnedIds, togglePin, isPinned }
}
