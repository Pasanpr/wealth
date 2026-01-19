'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { TaxProfile } from '@/lib/types'
import { Plus } from 'lucide-react'

export default function TaxProfilePage() {
  const [profiles, setProfiles] = useState<TaxProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    year: new Date().getFullYear().toString(),
    gross_income: '',
    federal_tax: '',
    state_tax: '',
  })

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/tax-profile')
      const data = await res.json()
      setProfiles(data)
    } catch (error) {
      console.error('Failed to fetch profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      year: parseInt(formData.year),
      gross_income: parseFloat(formData.gross_income),
      federal_tax: parseFloat(formData.federal_tax),
      state_tax: parseFloat(formData.state_tax),
    }

    try {
      const res = await fetch('/api/tax-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to save profile')
        return
      }

      setDialogOpen(false)
      resetForm()
      fetchProfiles()
    } catch (error) {
      console.error('Failed to save profile:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      year: new Date().getFullYear().toString(),
      gross_income: '',
      federal_tax: '',
      state_tax: '',
    })
  }

  const openNewDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  return (
    <PageContainer
      title="Tax Profile"
      description="Configure income and tax rates for RSU net proceeds calculations"
      actions={
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Year
        </Button>
      }
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>About Tax Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tax profiles are used to calculate the effective tax rate for RSU vesting calculations.
            Enter your gross income and total taxes paid (federal + state) for each year to
            get accurate net proceeds estimates.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tax profiles yet. Click &quot;Add Year&quot; to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Gross Income</TableHead>
                  <TableHead className="text-right">Federal Tax</TableHead>
                  <TableHead className="text-right">State Tax</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                  <TableHead className="text-right">Effective Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map(profile => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.year}</TableCell>
                    <TableCell className="text-right">{formatCurrency(profile.gross_income)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(profile.federal_tax)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(profile.state_tax)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(profile.federal_tax + profile.state_tax)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercent(profile.effective_rate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tax Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="year">Tax Year</Label>
                <Input
                  id="year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={formData.year}
                  onChange={e => setFormData({ ...formData, year: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gross_income">Gross Income</Label>
                <Input
                  id="gross_income"
                  type="number"
                  step="0.01"
                  value={formData.gross_income}
                  onChange={e => setFormData({ ...formData, gross_income: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="federal_tax">Federal Tax Paid</Label>
                  <Input
                    id="federal_tax"
                    type="number"
                    step="0.01"
                    value={formData.federal_tax}
                    onChange={e => setFormData({ ...formData, federal_tax: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="state_tax">State Tax Paid</Label>
                  <Input
                    id="state_tax"
                    type="number"
                    step="0.01"
                    value={formData.state_tax}
                    onChange={e => setFormData({ ...formData, state_tax: e.target.value })}
                    required
                  />
                </div>
              </div>
              {formData.gross_income && formData.federal_tax && formData.state_tax && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">
                    Effective Rate:{' '}
                    <span className="font-bold">
                      {formatPercent(
                        (parseFloat(formData.federal_tax) + parseFloat(formData.state_tax)) /
                        parseFloat(formData.gross_income)
                      )}
                    </span>
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
