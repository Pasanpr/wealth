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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { IncomeRecord, IncomeType } from '@/lib/types'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const incomeTypes: { value: IncomeType; label: string }[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'rsu_vesting', label: 'RSU Vesting' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'other', label: 'Other' },
]

export default function IncomePage() {
  const [records, setRecords] = useState<IncomeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<IncomeRecord | null>(null)
  const [formData, setFormData] = useState({
    income_type: 'salary' as IncomeType,
    amount: '',
    date: '',
    description: '',
    is_recurring: false,
  })

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/income')
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
      ...formData,
      amount: parseFloat(formData.amount),
    }

    try {
      if (editingRecord) {
        await fetch(`/api/income/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/income', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setDialogOpen(false)
      setEditingRecord(null)
      setFormData({
        income_type: 'salary',
        amount: '',
        date: '',
        description: '',
        is_recurring: false,
      })
      fetchRecords()
    } catch (error) {
      console.error('Failed to save record:', error)
    }
  }

  const handleEdit = (record: IncomeRecord) => {
    setEditingRecord(record)
    setFormData({
      income_type: record.income_type,
      amount: record.amount.toString(),
      date: record.date,
      description: record.description || '',
      is_recurring: Boolean(record.is_recurring),
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      await fetch(`/api/income/${id}`, { method: 'DELETE' })
      fetchRecords()
    } catch (error) {
      console.error('Failed to delete record:', error)
    }
  }

  const openNewDialog = () => {
    setEditingRecord(null)
    setFormData({
      income_type: 'salary',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      is_recurring: false,
    })
    setDialogOpen(true)
  }

  const totalIncome = records.reduce((sum, r) => sum + r.amount, 0)

  return (
    <PageContainer
      title="Income Records"
      description="Track salary, RSU vesting, bonuses, and other income"
      actions={
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Income
        </Button>
      }
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
          <p className="text-sm text-muted-foreground">Total recorded income</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No income records yet. Click &quot;Add Income&quot; to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Recurring</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell className="capitalize">
                      {record.income_type.replace('_', ' ')}
                    </TableCell>
                    <TableCell>{record.description || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(record.amount)}
                    </TableCell>
                    <TableCell>{record.is_recurring ? 'Yes' : 'No'}</TableCell>
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
              {editingRecord ? 'Edit Income Record' : 'Add Income Record'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="income_type">Type</Label>
                <Select
                  value={formData.income_type}
                  onValueChange={(value: IncomeType) =>
                    setFormData({ ...formData, income_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={e => setFormData({ ...formData, is_recurring: e.target.checked })}
                />
                <Label htmlFor="is_recurring">Recurring income</Label>
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
