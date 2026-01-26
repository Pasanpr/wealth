'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  PieChart,
  Upload,
  Settings,
  DollarSign,
  TrendingUp,
  Briefcase,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react'
import { useState } from 'react'
import { ThemeToggle } from '@/components/theme/theme-toggle'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  children?: { title: string; href: string }[]
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Cash & Income',
    href: '/cash',
    icon: Wallet,
    children: [
      { title: 'Overview', href: '/cash' },
      { title: 'Cash Balances', href: '/cash/balances' },
      { title: 'Income', href: '/cash/income' },
      { title: 'RSU Vesting', href: '/cash/rsu' },
      { title: 'Cash Health', href: '/cash/health' },
    ],
  },
  {
    title: 'Pay Statements',
    href: '/pay-statements',
    icon: FileText,
    children: [
      { title: 'Dashboard', href: '/pay-statements' },
      { title: 'Import', href: '/pay-statements/import' },
      { title: 'History', href: '/pay-statements/history' },
    ],
  },
  {
    title: 'Spending',
    href: '/cashflow',
    icon: CreditCard,
    children: [
      { title: 'Monthly Grid', href: '/cashflow' },
      { title: 'Manual Entry', href: '/cashflow/entry' },
      { title: 'Manage Cards', href: '/cashflow/cards' },
      { title: 'Trends', href: '/cashflow/trends' },
    ],
  },
  {
    title: 'Portfolio',
    href: '/portfolio',
    icon: PieChart,
    children: [
      { title: 'Overview', href: '/portfolio' },
      { title: 'Accounts', href: '/portfolio/accounts' },
      { title: 'Holdings', href: '/portfolio/holdings' },
      { title: 'Allocation', href: '/portfolio/allocation' },
      { title: 'Returns', href: '/portfolio/returns' },
      { title: 'RSU Advisor', href: '/portfolio/rsu-advisor' },
    ],
  },
  {
    title: 'Import',
    href: '/import',
    icon: Upload,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    children: [
      { title: 'General', href: '/settings' },
      { title: 'Asset Classes', href: '/settings/asset-classes' },
      { title: 'Securities', href: '/settings/securities' },
      { title: 'Fixed Expenses', href: '/settings/fixed-expenses' },
      { title: 'Tax Profile', href: '/settings/tax-profile' },
      { title: 'Data Management', href: '/settings/data-management' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>(['/cash', '/pay-statements', '/cashflow', '/portfolio', '/settings'])

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev =>
      prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
    )
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const getIconColor = (isActiveItem: boolean) => {
    return isActiveItem ? 'text-primary' : ''
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <DollarSign className="h-6 w-6 text-primary" />
        <span className="ml-2 text-xl font-bold">Wealth</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.href}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <span className="flex items-center">
                      <item.icon className={cn('mr-3 h-4 w-4', getIconColor(isActive(item.href)))} />
                      {item.title}
                    </span>
                    {expandedItems.includes(item.href) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {expandedItems.includes(item.href) && (
                    <ul className="ml-6 mt-1 space-y-1">
                      {item.children.map(child => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              'block rounded-md px-3 py-2 text-sm transition-colors',
                              pathname === child.href
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            {child.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className={cn('mr-3 h-4 w-4', getIconColor(isActive(item.href)))} />
                  {item.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
