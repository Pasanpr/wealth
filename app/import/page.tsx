'use client'

import { useState } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui'
import { ImportCard } from '@/components/import/import-card'
import {
  FileText,
  GraduationCap,
  Building2,
  FileSpreadsheet,
  Receipt,
  DollarSign,
  Wallet,
  TrendingUp,
  PiggyBank,
  Calculator,
} from 'lucide-react'

// Import the actual import components (embedded in dialogs)
import { VanguardImport } from '@/components/import/portfolio/vanguard-import'
import { Vanguard529Import } from '@/components/import/portfolio/vanguard-529-import'
import { Fidelity401kImport } from '@/components/import/portfolio/fidelity-401k-import'
import { PayStatementImport } from '@/components/import/income/pay-statement-import'
import { RsuImport } from '@/components/import/income/rsu-import'
import { EtradeCsvImport } from '@/components/import/income/etrade-csv-import'
import { MonthlyBalancesImport } from '@/components/import/balances/monthly-balances-import'
import { GenericCsvImport } from '@/components/import/balances/generic-csv-import'

type ImportDialogType =
  | 'vanguard'
  | '529'
  | '401k'
  | 'pay-statements'
  | 'rsu'
  | 'etrade-csv'
  | 'monthly-balances'
  | 'cash-flows'
  | 'income'
  | 'securities'
  | 'holdings'
  | 'tax-profile'
  | null

const importCategories = [
  {
    label: 'Portfolio & Investments',
    imports: [
      {
        id: 'vanguard' as const,
        title: 'Vanguard Brokerage',
        description: 'Import holdings and transactions from Vanguard CSV export',
        fileType: 'CSV',
        icon: FileText,
      },
      {
        id: '529' as const,
        title: '529 Plan',
        description: 'Import Vanguard 529 college savings statements',
        fileType: 'PDF',
        icon: GraduationCap,
      },
      {
        id: '401k' as const,
        title: 'Fidelity 401(k)',
        description: 'Import 401(k) statements or transaction history',
        fileType: 'PDF / CSV',
        icon: Building2,
      },
    ],
  },
  {
    label: 'Income & Earnings',
    imports: [
      {
        id: 'pay-statements' as const,
        title: 'ADP Pay Statements',
        description: 'Import earnings and tax data from pay stub PDFs',
        fileType: 'PDF (batch)',
        icon: Receipt,
      },
      {
        id: 'rsu' as const,
        title: 'RSU Tax Documents',
        description: 'Import E*Trade Stock Plan Supplement or 1099-B',
        fileType: 'PDF',
        icon: TrendingUp,
      },
      {
        id: 'etrade-csv' as const,
        title: 'E*Trade Benefits',
        description: 'Import upcoming vest schedule from E*Trade CSV export',
        fileType: 'CSV',
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    label: 'Balances & Tracking',
    imports: [
      {
        id: 'monthly-balances' as const,
        title: 'Monthly Balances',
        description: 'Import credit card and cash account balances from spreadsheet',
        fileType: 'CSV',
        icon: Wallet,
      },
      {
        id: 'cash-flows' as const,
        title: 'Cash Flows',
        description: 'Import account contributions and withdrawals',
        fileType: 'CSV',
        icon: DollarSign,
      },
      {
        id: 'income' as const,
        title: 'Income Records',
        description: 'Import salary, RSU vesting, bonuses',
        fileType: 'CSV',
        icon: PiggyBank,
      },
    ],
  },
  {
    label: 'Reference Data',
    imports: [
      {
        id: 'securities' as const,
        title: 'Securities',
        description: 'Import fund, ETF, and stock definitions',
        fileType: 'CSV',
        icon: FileText,
      },
      {
        id: 'holdings' as const,
        title: 'Holdings Snapshot',
        description: 'Import investment positions with values',
        fileType: 'CSV',
        icon: TrendingUp,
      },
      {
        id: 'tax-profile' as const,
        title: 'Tax Profile',
        description: 'Import annual income and tax data',
        fileType: 'CSV',
        icon: Calculator,
      },
    ],
  },
]

const dialogTitles: Record<Exclude<ImportDialogType, null>, { title: string; description: string }> = {
  vanguard: { title: 'Import Vanguard Brokerage', description: 'Upload your Vanguard CSV export file' },
  '529': { title: 'Import 529 Plan Statement', description: 'Upload your Vanguard 529 statement PDF' },
  '401k': { title: 'Import Fidelity 401(k)', description: 'Upload your 401(k) statement PDF or transaction CSV' },
  'pay-statements': { title: 'Import Pay Statements', description: 'Upload ADP pay stub PDFs' },
  rsu: { title: 'Import RSU Documents', description: 'Upload E*Trade tax documents' },
  'etrade-csv': { title: 'Import E*Trade Benefits CSV', description: 'Upload your E*Trade benefits export' },
  'monthly-balances': { title: 'Import Monthly Balances', description: 'Upload your balance spreadsheet' },
  'cash-flows': { title: 'Import Cash Flows', description: 'Upload cash flow CSV' },
  income: { title: 'Import Income Records', description: 'Upload income CSV' },
  securities: { title: 'Import Securities', description: 'Upload securities CSV' },
  holdings: { title: 'Import Holdings Snapshot', description: 'Upload holdings CSV' },
  'tax-profile': { title: 'Import Tax Profile', description: 'Upload tax profile CSV' },
}

export default function ImportPage() {
  const [activeDialog, setActiveDialog] = useState<ImportDialogType>(null)

  const handleImportComplete = () => {
    setActiveDialog(null)
  }

  const renderDialogContent = () => {
    switch (activeDialog) {
      case 'vanguard':
        return <VanguardImport onComplete={handleImportComplete} />
      case '529':
        return <Vanguard529Import onComplete={handleImportComplete} />
      case '401k':
        return <Fidelity401kImport onComplete={handleImportComplete} />
      case 'pay-statements':
        return <PayStatementImport onComplete={handleImportComplete} />
      case 'rsu':
        return <RsuImport onComplete={handleImportComplete} />
      case 'etrade-csv':
        return <EtradeCsvImport onComplete={handleImportComplete} />
      case 'monthly-balances':
        return <MonthlyBalancesImport onComplete={handleImportComplete} />
      case 'cash-flows':
        return (
          <GenericCsvImport
            importType="cash_flows"
            format="date,account_name,amount,flow_type,description"
            example="2024-01-15,Fidelity Brokerage,1000.00,contribution,Monthly contribution"
            helpText="flow_type must be: contribution, withdrawal, dividend, or interest"
            onComplete={handleImportComplete}
          />
        )
      case 'income':
        return (
          <GenericCsvImport
            importType="income"
            format="date,income_type,amount,description,is_recurring"
            example="2024-01-15,salary,8500.00,Monthly salary,true"
            helpText="income_type must be: salary, rsu_vesting, bonus, or other"
            onComplete={handleImportComplete}
          />
        )
      case 'securities':
        return (
          <GenericCsvImport
            importType="securities"
            format="symbol,name,asset_class"
            example="VTSAX,Vanguard Total Stock Market Index,US Total Market"
            onComplete={handleImportComplete}
          />
        )
      case 'holdings':
        return (
          <GenericCsvImport
            importType="holdings"
            format="date,account_name,symbol,value,shares,cost_basis"
            example="2024-01-31,Fidelity Brokerage,VTSAX,50000.00,250,45000.00"
            helpText="Accounts and securities must exist before importing holdings"
            onComplete={handleImportComplete}
          />
        )
      case 'tax-profile':
        return (
          <GenericCsvImport
            importType="tax_profile"
            format="year,gross_income,federal_tax,state_tax"
            example="2023,250000,45000,15000"
            onComplete={handleImportComplete}
          />
        )
      default:
        return null
    }
  }

  return (
    <PageContainer
      title="Import Data"
      description="Import financial data from various sources"
    >
      <div className="space-y-8">
        {importCategories.map((category) => (
          <div key={category.label}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {category.label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {category.imports.map((importItem) => (
                <ImportCard
                  key={importItem.id}
                  title={importItem.title}
                  description={importItem.description}
                  fileType={importItem.fileType}
                  icon={importItem.icon}
                  onClick={() => setActiveDialog(importItem.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={activeDialog !== null} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {activeDialog && (
            <>
              <DialogHeader>
                <DialogTitle>{dialogTitles[activeDialog].title}</DialogTitle>
                <DialogDescription>{dialogTitles[activeDialog].description}</DialogDescription>
              </DialogHeader>
              {renderDialogContent()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
