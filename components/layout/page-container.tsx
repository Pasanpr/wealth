import { cn } from '@/lib/utils/cn'

interface PageContainerProps {
  children: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageContainer({
  children,
  title,
  description,
  actions,
  className,
}: PageContainerProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>
      <div className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 dark:from-primary/10 dark:via-purple-500/10 dark:to-pink-500/10 backdrop-blur-sm px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground dark:bg-gradient-to-r dark:from-primary dark:via-purple-300 dark:to-pink-300 dark:bg-clip-text dark:text-transparent">{title}</h1>
            {description && (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
      <div className="p-8">{children}</div>
    </div>
  )
}
