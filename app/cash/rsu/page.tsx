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
import { formatCurrency, formatDate, formatShares } from '@/lib/utils/format'
import { RsuVesting } from '@/lib/types'
import { Plus, Pencil, Trash2, CheckCircle, Clock } from 'lucide-react'

export default function RsuPage() {
  const [records, setRecords] = useState<RsuVesting[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<RsuVesting | null>(null)
  const [formData, setFormData] = useState({
    vest_date: '',
    shares: '',
    grant_price: '',
    grant_date: '',
    grant_id: '',
    is_vested: false,
    actual_price_at_vest: '',
  })

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/rsu')
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
      shares: parseFloat(formData.shares),
      grant_price: parseFloat(formData.grant_price),
      actual_price_at_vest: formData.actual_price_at_vest ? parseFloat(formData.actual_price_at_vest) : null,
    }

    try {
      if (editingRecord) {
        await fetch(`/api/rsu/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/rsu', {
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
      vest_date: '',
      shares: '',
      grant_price: '',
      grant_date: '',
      grant_id: '',
      is_vested: false,
      actual_price_at_vest: '',
    })
  }

  const handleEdit = (record: RsuVesting) => {
    setEditingRecord(record)
    setFormData({
      vest_date: record.vest_date,
      shares: record.shares.toString(),
      grant_price: record.grant_price.toString(),
      grant_date: record.grant_date,
      grant_id: record.grant_id || '',
      is_vested: Boolean(record.is_vested),
      actual_price_at_vest: record.actual_price_at_vest?.toString() || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      await fetch(`/api/rsu/${id}`, { method: 'DELETE' })
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

  const pendingShares = records.filter(r => !r.is_vested).reduce((sum, r) => sum + r.shares, 0)
  const vestedShares = records.filter(r => r.is_vested).reduce((sum, r) => sum + r.shares, 0)
  const vestedValue = records
    .filter(r => r.is_vested && r.actual_price_at_vest)
    .reduce((sum, r) => sum + (r.shares * (r.actual_price_at_vest || 0)), 0)

  return (
    <PageContainer
      title="RSU Vesting Schedule"
      description="Track your restricted stock unit vesting schedule"
      actions={
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Vesting
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Shares</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatShares(pendingShares)}</div>
            <p className="text-xs text-muted-foreground">Unvested RSUs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vested Shares</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatShares(vestedShares)}</div>
            <p className="text-xs text-muted-foreground">Total vested</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vested Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(vestedValue)}</div>
            <p className="text-xs text-muted-foreground">At vest prices</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vesting Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No RSU vesting records yet. Click &quot;Add Vesting&quot; to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vest Date</TableHead>
                  <TableHead>Grant ID</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Grant Price</TableHead>
                  <TableHead className="text-right">Vest Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDate(record.vest_date)}</TableCell>
                    <TableCell>{record.grant_id || '-'}</TableCell>
                    <TableCell className="text-right">{formatShares(record.shares)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.grant_price)}</TableCell>
                    <TableCell className="text-right">
                      {record.actual_price_at_vest ? formatCurrency(record.actual_price_at_vest) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        record.is_vested
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {record.is_vested ? 'Vested' : 'Pending'}
                      </span>
                    </TableCell>
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
              {editingRecord ? 'Edit RSU Vesting' : 'Add RSU Vesting'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="grant_date">Grant Date</Label>
                  <Input
                    id="grant_date"
                    type="date"
                    value={formData.grant_date}
                    onChange={e => setFormData({ ...formData, grant_date: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vest_date">Vest Date</Label>
                  <Input
                    id="vest_date"
                    type="date"
                    value={formData.vest_date}
                    onChange={e => setFormData({ ...formData, vest_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="grant_id">Grant ID (Optional)</Label>
                <Input
                  id="grant_id"
                  value={formData.grant_id}
                  onChange={e => setFormData({ ...formData, grant_id: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="shares">Shares</Label>
                  <Input
                    id="shares"
                    type="number"
                    step="0.0001"
                    value={formData.shares}
                    onChange={e => setFormData({ ...formData, shares: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="grant_price">Grant Price</Label>
                  <Input
                    id="grant_price"
                    type="number"
                    step="0.01"
                    value={formData.grant_price}
                    onChange={e => setFormData({ ...formData, grant_price: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_vested"
                  checked={formData.is_vested}
                  onChange={e => setFormData({ ...formData, is_vested: e.target.checked })}
                />
                <Label htmlFor="is_vested">Already vested</Label>
              </div>
              {formData.is_vested && (
                <div className="grid gap-2">
                  <Label htmlFor="actual_price_at_vest">Price at Vest</Label>
                  <Input
                    id="actual_price_at_vest"
                    type="number"
                    step="0.01"
                    value={formData.actual_price_at_vest}
                    onChange={e => setFormData({ ...formData, actual_price_at_vest: e.target.value })}
                  />
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
