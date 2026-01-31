'use client'

import * as React from 'react'
import { HelpCircle } from 'lucide-react'
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { glossary, GlossaryEntry } from '@/lib/glossary'
import { cn } from '@/lib/utils'

interface TermTooltipProps {
  /** The glossary key for the term (e.g., 'asset-allocation', 'twr') */
  term: keyof typeof glossary
  /** The text to display - defaults to the term's display name */
  children?: React.ReactNode
  /** Show a help icon instead of/alongside the text */
  showIcon?: boolean
  /** Only show the icon, not the text */
  iconOnly?: boolean
  /** Additional className for the trigger */
  className?: string
}

/**
 * TermTooltip - Wraps financial terms with educational tooltips
 *
 * Usage:
 * <TermTooltip term="asset-allocation">Asset Allocation</TermTooltip>
 * <TermTooltip term="twr" showIcon>Time-Weighted Return</TermTooltip>
 * <TermTooltip term="rebalancing" iconOnly />
 */
export function TermTooltip({
  term,
  children,
  showIcon = false,
  iconOnly = false,
  className,
}: TermTooltipProps) {
  const entry = glossary[term]

  if (!entry) {
    console.warn(`TermTooltip: Unknown glossary term "${term}"`)
    return <>{children}</>
  }

  const displayText = children || entry.term

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 cursor-help',
            !iconOnly && 'border-b border-dotted border-muted-foreground/50 hover:border-primary',
            className
          )}
        >
          {!iconOnly && displayText}
          {(showIcon || iconOnly) && (
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-xs p-3 bg-popover text-popover-foreground"
        side="top"
        sideOffset={5}
      >
        <div className="space-y-2">
          <p className="font-medium text-sm">{entry.term}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {entry.definition}
          </p>
          {entry.example && (
            <p className="text-xs text-muted-foreground/80 italic">
              Example: {entry.example}
            </p>
          )}
          <Link
            href="/settings/glossary"
            className="text-xs text-primary hover:underline block pt-1"
          >
            View all terms →
          </Link>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * HelpTooltip - A standalone help icon with custom tooltip content
 * For non-glossary help text
 */
interface HelpTooltipProps {
  children: React.ReactNode
  className?: string
}

export function HelpTooltip({ children, className }: HelpTooltipProps) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex cursor-help', className)}>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-xs p-3 bg-popover text-popover-foreground"
        side="top"
        sideOffset={5}
      >
        <div className="text-xs text-muted-foreground leading-relaxed">
          {children}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
