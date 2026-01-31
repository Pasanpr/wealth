'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button, Progress } from '@/components/ui'
import {
  PieChart,
  Briefcase,
  Building2,
  CreditCard,
  Upload,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Target,
} from 'lucide-react'
import Link from 'next/link'

interface Step {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  field: string
  tips: string[]
}

const steps: Step[] = [
  {
    id: 'asset-classes',
    title: 'Set Up Asset Classes',
    description: 'Define how you want to divide your investments (stocks, bonds, etc.)',
    icon: PieChart,
    href: '/settings/asset-classes',
    field: 'asset_classes_done',
    tips: [
      'Asset classes are categories like stocks, bonds, and cash',
      'A common split is 60% stocks, 30% bonds, 10% cash',
      'Younger investors often have more stocks, older more bonds',
    ],
  },
  {
    id: 'securities',
    title: 'Add Your Investments',
    description: 'Add the funds, ETFs, or stocks you own',
    icon: Briefcase,
    href: '/settings/securities',
    field: 'securities_done',
    tips: [
      'Securities are the specific investments you own',
      'Examples: VTSAX (total stock market), BND (bonds)',
      'You can add more later as your portfolio grows',
    ],
  },
  {
    id: 'accounts',
    title: 'Create Accounts',
    description: 'Set up your investment accounts (401k, IRA, brokerage)',
    icon: Building2,
    href: '/portfolio/accounts',
    field: 'accounts_done',
    tips: [
      '401(k) is typically through your employer',
      'IRA is a personal retirement account',
      'Brokerage accounts have no tax advantages but more flexibility',
    ],
  },
  {
    id: 'credit-cards',
    title: 'Add Credit Cards',
    description: 'Track spending across your credit cards',
    icon: CreditCard,
    href: '/cashflow/cards',
    field: 'credit_cards_done',
    tips: [
      'Adding cards helps track monthly spending',
      'This is optional if you only want portfolio tracking',
      'You can skip this step and add cards later',
    ],
  },
  {
    id: 'import',
    title: 'Import Your Data',
    description: 'Import holdings and balances from your accounts',
    icon: Upload,
    href: '/import',
    field: 'import_done',
    tips: [
      'You can import CSV files from your brokerage',
      'Or enter holdings manually on the Holdings page',
      'Import historical data to see performance over time',
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/onboarding')
      .then(res => res.json())
      .then(data => {
        const completed = new Set<string>()
        if (data.asset_classes_done) completed.add('asset-classes')
        if (data.securities_done) completed.add('securities')
        if (data.accounts_done) completed.add('accounts')
        if (data.credit_cards_done) completed.add('credit-cards')
        if (data.import_done) completed.add('import')
        setCompletedSteps(completed)

        // Find first incomplete step
        const firstIncomplete = steps.findIndex(s => !completed.has(s.id))
        if (firstIncomplete >= 0) {
          setCurrentStep(firstIncomplete)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const step = steps[currentStep]
  const progress = ((completedSteps.size) / steps.length) * 100

  const markComplete = async (stepId: string) => {
    const fieldName = steps.find(s => s.id === stepId)?.field
    if (!fieldName) return

    await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [fieldName]: true }),
    })

    setCompletedSteps(prev => new Set([...prev, stepId]))
  }

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      router.push('/')
    }
  }

  const handleComplete = async () => {
    await markComplete(step.id)
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      router.push('/')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // All done state
  if (completedSteps.size === steps.length) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl">All Set!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You&apos;ve completed the setup. Your dashboard is now ready with all your financial data.
            </p>
            <Button asChild className="w-full">
              <Link href="/">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to Wealth</h1>
          <p className="text-muted-foreground">
            Let&apos;s get your finances set up in a few simple steps
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Setup Progress</span>
            <span className="font-medium">{completedSteps.size} of {steps.length} complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((s, index) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                completedSteps.has(s.id)
                  ? 'bg-green-500'
                  : index === currentStep
                  ? 'bg-primary'
                  : 'bg-muted'
              }`}
              title={s.title}
            />
          ))}
        </div>

        {/* Current Step Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${
                completedSteps.has(step.id)
                  ? 'bg-green-500/20'
                  : 'bg-primary/20'
              }`}>
                {completedSteps.has(step.id) ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <step.icon className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground">
                    Step {currentStep + 1} of {steps.length}
                  </span>
                  {completedSteps.has(step.id) && (
                    <span className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full">
                      Complete
                    </span>
                  )}
                </div>
                <CardTitle className="text-xl">{step.title}</CardTitle>
                <p className="text-muted-foreground mt-1">{step.description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tips */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Quick Tips</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {step.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" asChild className="flex-1">
                <Link href={step.href}>
                  Open {step.title.split(' ').slice(-1)[0]} Page
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {completedSteps.has(step.id) ? (
                <Button onClick={handleComplete} className="flex-1">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleComplete} className="flex-1">
                  Mark as Complete
                  <CheckCircle className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/">Exit to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
