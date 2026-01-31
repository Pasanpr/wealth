'use client'

import { cn } from '@/lib/utils/cn'
import { CheckCircle, AlertTriangle, AlertCircle, LucideIcon } from 'lucide-react'

interface MetricItem {
  label: string
  value: string
  subtext?: string
}

interface CompactMetricsProps {
  metrics: MetricItem[]
  status?: 'healthy' | 'warning' | 'critical'
  statusLabel?: string
  progressValue?: number
  className?: string
}

const STATUS_CONFIG = {
  healthy: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-600',
    label: 'Healthy',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-600',
    label: 'Warning',
  },
  critical: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-600',
    label: 'Critical',
  },
}

export function CompactMetrics({
  metrics,
  status,
  statusLabel,
  progressValue,
  className,
}: CompactMetricsProps) {
  const statusConfig = status ? STATUS_CONFIG[status] : null
  const StatusIcon = statusConfig?.icon

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4',
        className
      )}
    >
      {/* Metrics row */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {metrics.map((metric, index) => (
          <div key={index} className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold">{metric.value}</span>
            <span className="text-sm text-muted-foreground">{metric.label}</span>
            {metric.subtext && (
              <span className="text-xs text-muted-foreground">({metric.subtext})</span>
            )}
            {index < metrics.length - 1 && (
              <span className="ml-4 text-muted-foreground/50">•</span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar with status */}
      {(status || progressValue !== undefined) && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                'h-full transition-all rounded-full',
                statusConfig?.bgColor || 'bg-primary'
              )}
              style={{ width: `${Math.min(progressValue || 0, 100)}%` }}
            />
          </div>
          {statusConfig && StatusIcon && (
            <div className={cn('flex items-center gap-1.5', statusConfig.color)}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {statusLabel || statusConfig.label}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A simpler inline stats display without progress bar
 */
interface InlineStatsProps {
  items: { label: string; value: string }[]
  className?: string
}

export function InlineStats({ items, className }: InlineStatsProps) {
  return (
    <div className={cn('flex flex-wrap gap-x-6 gap-y-1', className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-baseline gap-1.5">
          <span className="font-semibold">{item.value}</span>
          <span className="text-sm text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
