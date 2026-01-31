'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LearnMoreProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  variant?: 'default' | 'tip' | 'help'
  className?: string
}

/**
 * LearnMore - An expandable section for educational content
 *
 * Usage:
 * <LearnMore title="Why track spending?">
 *   Tracking spending helps you understand where your money goes...
 * </LearnMore>
 *
 * <LearnMore title="Pro tip" variant="tip" defaultOpen>
 *   You can import data directly from your brokerage...
 * </LearnMore>
 */
export function LearnMore({
  title,
  children,
  defaultOpen = false,
  variant = 'default',
  className,
}: LearnMoreProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const Icon = variant === 'tip' ? Lightbulb : HelpCircle

  const variantStyles = {
    default: 'bg-muted/50 border-muted hover:bg-muted/70',
    tip: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
    help: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20',
  }

  const iconStyles = {
    default: 'text-muted-foreground',
    tip: 'text-amber-600 dark:text-amber-400',
    help: 'text-blue-600 dark:text-blue-400',
  }

  return (
    <div className={cn('rounded-lg border', variantStyles[variant], className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icon className={cn('h-4 w-4', iconStyles[variant])} />
          {title}
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-0">
          <div className="text-sm text-muted-foreground leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * QuickTip - A non-collapsible tip box for important information
 */
interface QuickTipProps {
  children: React.ReactNode
  className?: string
}

export function QuickTip({ children, className }: QuickTipProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30',
        className
      )}
    >
      <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}
