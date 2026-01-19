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
import { formatCurrency } from '@/lib/utils/format'
import { YearlyExpense } from '@/lib/types'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function ExpensesPage() {
  const [records, setRecords] = useState<YearlyExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<YearlyExpense | null>(null)
  const [formData, setFormData] = useState({
    year: new Date().getFullYear().toString(),
    total_amount: '',
    notes: '',
  })

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/expenses')
      const data = await res.json()
      setRecords(data)
    } catch (error) {
      console.error('Failed to fetch records:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      year: parseInt(formData.year),
      total_amount: parseFloat(formData.total_amount),
      notes: formData.notes || null,
    }

    try {
      if (editingRecord) {
        await fetch(`/api/expenses/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setDialogOpen(false)
      setEditingRecord(null)
      resetForm()
      fetchRecords()
    } catch (error) {
      console.error('Failed to save record:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      year: new Date().getFullYear().toString(),
      total_amount: '',
      notes: '',
    })
  }

  const handleEdit = (record: YearlyExpense) => {
    setEditingRecord(record)
    setFormData({
      year: record.year.toString(),
      total_amount: record.total_amount.toString(),
      notes: record.notes || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      fetchRecords()
    } catch (error) {
      console.error('Failed to delete record:', error)
    }
  }

  const openNewDialog = () => {
    setEditingRecord(null)
    resetForm()
    setDialogOpen(true)
  }

  const averageMonthly = records.length > 0
    ? records.reduce((sum, r) => sum + r.total_amount, 0) / (records.length * 12)
    : 0

  return (
    <PageContainer
      title="Yearly Expenses"
      description="Track your annual expense totals for cash health analysis"
      actions={
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Year
        </Button>
      }
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-2xl font-bold">{formatCurrency(averageMonthly)}</div>
              <p className="text-sm text-muted-foreground">Average monthly expenses</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{records.length}</div>
              <p className="text-sm text-muted-foreground">Years of data</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annual Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No expense records yet. Click &quot;Add Year&quot; to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Total Expenses</TableHead>
                  <TableHead className="text-right">Monthly Average</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.year}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.total_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.total_amount / 12)}</TableCell>
                    <TableCell>{record.notes || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(record)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
            <DialogTitle>
              {editingRecord ? 'Edit Yearly Expense' : 'Add Yearly Expense'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="year">Year</Label>
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
                <Label htmlFor="total_amount">Total Annual Expenses</Label>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  value={formData.total_amount}
                  onChange={e => setFormData({ ...formData, total_amount: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
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
