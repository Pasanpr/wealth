'use client'

import { cn } from '@/lib/utils/cn'
import { LucideIcon } from 'lucide-react'

interface ImportCardProps {
  title: string
  description: string
  fileType: string
  icon: LucideIcon
  onClick: () => void
  className?: string
}

export function ImportCard({
  title,
  description,
  fileType,
  icon: Icon,
  onClick,
  className,
}: ImportCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start p-4 rounded-lg border bg-card text-left transition-all',
        'hover:border-primary/50 hover:bg-accent/50',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-md bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-sm">{title}</h3>
          <span className="text-xs text-muted-foreground">{fileType}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
    </button>
  )
}
