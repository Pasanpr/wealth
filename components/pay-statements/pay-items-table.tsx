'use client'

import { PayStatementItemWithCategory, PayItemCategoryCode } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PayItemsTableProps {
  items: PayStatementItemWithCategory[]
  showYtd?: boolean
}

const CATEGORY_CONFIG: Record<
  PayItemCategoryCode,
  { title: string; amountClass: string; sign: '+' | '-' | '' }
> = {
  earnings: { title: 'Earnings', amountClass: '', sign: '+' },
  statutory_tax: { title: 'Taxes', amountClass: 'text-red-500', sign: '-' },
  pretax_deduction: { title: 'Pre-Tax Deductions', amountClass: 'text-red-500', sign: '-' },
  posttax_deduction: { title: 'Post-Tax Deductions', amountClass: 'text-red-500', sign: '-' },
  employer_benefit: { title: 'Employer Benefits', amountClass: 'text-green-500', sign: '+' },
  adjustment: { title: 'Adjustments', amountClass: 'text-blue-500', sign: '+' },
  rsu_withholding: { title: 'RSU Withholding', amountClass: 'text-muted-foreground', sign: '' },
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function groupByCategory(
  items: PayStatementItemWithCategory[]
): Record<PayItemCategoryCode, PayStatementItemWithCategory[]> {
  const groups: Record<PayItemCategoryCode, PayStatementItemWithCategory[]> = {
    earnings: [],
    statutory_tax: [],
    pretax_deduction: [],
    posttax_deduction: [],
    employer_benefit: [],
    adjustment: [],
    rsu_withholding: [],
  }

  for (const item of items) {
    const category = item.category_code as PayItemCategoryCode
    if (groups[category]) {
      groups[category].push(item)
    }
  }

  return groups
}

export function PayItemsTable({ items, showYtd = true }: PayItemsTableProps) {
  const grouped = groupByCategory(items)
  const categories = Object.keys(CATEGORY_CONFIG) as PayItemCategoryCode[]

  return (
    <div className="space-y-6">
      {categories.map(category => {
        const categoryItems = grouped[category]
        if (categoryItems.length === 0) return null

        const config = CATEGORY_CONFIG[category]
        const total = categoryItems.reduce((sum, item) => sum + item.current_amount, 0)
        const ytdTotal = categoryItems.reduce(
          (sum, item) => sum + (item.ytd_amount ?? 0),
          0
        )

        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{config.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    {category === 'earnings' && (
                      <>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Current</TableHead>
                    {showYtd && <TableHead className="text-right">YTD</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.item_name}</TableCell>
                      {category === 'earnings' && (
                        <>
                          <TableCell className="text-right">
                            {item.hours?.toFixed(2) ?? '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.rate ? formatCurrency(item.rate) : '-'}
                          </TableCell>
                        </>
                      )}
                      <TableCell className={`text-right ${config.amountClass}`}>
                        {config.sign === '-' ? '-' : ''}
                        {formatCurrency(item.current_amount)}
                      </TableCell>
                      {showYtd && (
                        <TableCell className="text-right text-muted-foreground">
                          {item.ytd_amount ? formatCurrency(item.ytd_amount) : '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell
                      colSpan={category === 'earnings' ? 3 : 1}
                      className="font-medium"
                    >
                      Total {config.title}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${config.amountClass}`}>
                      {config.sign === '-' ? '-' : ''}
                      {formatCurrency(total)}
                    </TableCell>
                    {showYtd && (
                      <TableCell className="text-right font-medium text-muted-foreground">
                        {formatCurrency(ytdTotal)}
                      </TableCell>
                    )}
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
