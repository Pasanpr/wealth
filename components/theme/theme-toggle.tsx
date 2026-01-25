'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'
import { cn } from '@/lib/utils/cn'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={cn(
        'relative h-9 w-9 rounded-lg flex items-center justify-center',
        'hover:bg-accent/50 active:scale-95 transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        mounted && theme === 'dark'
          ? 'text-yellow-400 hover:text-yellow-300'
          : mounted
            ? 'text-blue-600 hover:text-blue-500'
            : 'text-muted-foreground'
      )}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {!mounted ? (
        <Sun className="h-4 w-4" />
      ) : theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  )
}
