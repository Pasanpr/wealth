'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type DisplayMode = 'simple' | 'advanced'

interface DisplayModeContextType {
  mode: DisplayMode
  setMode: (mode: DisplayMode) => void
  isSimple: boolean
  isAdvanced: boolean
  loading: boolean
}

const DisplayModeContext = createContext<DisplayModeContextType | undefined>(undefined)

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DisplayMode>('simple')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch current mode from API
    fetch('/api/settings/display-mode')
      .then(res => res.json())
      .then(data => {
        if (data.mode) {
          setModeState(data.mode)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const setMode = async (newMode: DisplayMode) => {
    setModeState(newMode)
    // Persist to database
    await fetch('/api/settings/display-mode', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode }),
    }).catch(console.error)
  }

  return (
    <DisplayModeContext.Provider
      value={{
        mode,
        setMode,
        isSimple: mode === 'simple',
        isAdvanced: mode === 'advanced',
        loading,
      }}
    >
      {children}
    </DisplayModeContext.Provider>
  )
}

export function useDisplayMode() {
  const context = useContext(DisplayModeContext)
  if (context === undefined) {
    throw new Error('useDisplayMode must be used within a DisplayModeProvider')
  }
  return context
}
