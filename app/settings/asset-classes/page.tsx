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
import { formatPercent } from '@/lib/utils/format'
import { AssetClass } from '@/lib/types'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function AssetClassesPage() {
  const [classes, setClasses] = useState<AssetClass[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<AssetClass | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_allocation: '',
    display_order: '0',
  })

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/asset-classes')
      const data = await res.json()
      setClasses(data)
    } catch (error) {
      console.error('Failed to fetch asset classes:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClasses()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      name: formData.name,
      description: formData.description || null,
      target_allocation: parseFloat(formData.target_allocation) || 0,
      display_order: parseInt(formData.display_order) || 0,
    }

    try {
      if (editingClass) {
        await fetch(`/api/asset-classes/${editingClass.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/asset-classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setDialogOpen(false)
      setEditingClass(null)
      resetForm()
      fetchClasses()
    } catch (error) {
      console.error('Failed to save asset class:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      target_allocation: '',
      display_order: '0',
    })
  }

  const handleEdit = (assetClass: AssetClass) => {
    setEditingClass(assetClass)
    setFormData({
      name: assetClass.name,
      description: assetClass.description || '',
      target_allocation: assetClass.target_allocation.toString(),
      display_order: assetClass.display_order.toString(),
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this asset class?')) return

    try {
      await fetch(`/api/asset-classes/${id}`, { method: 'DELETE' })
      fetchClasses()
    } catch (error) {
      console.error('Failed to delete asset class:', error)
    }
  }

  const openNewDialog = () => {
    setEditingClass(null)
    resetForm()
    setDialogOpen(true)
  }

  const totalAllocation = classes.reduce((sum, c) => sum + c.target_allocation, 0)

  return (
    <PageContainer
      title="Asset Classes"
      description="Configure asset classes and target allocations"
      actions={
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Asset Class
        </Button>
      }
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Target Allocation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${totalAllocation === 100 ? 'text-green-600' : 'text-yellow-600'}`}>
            {totalAllocation}%
          </div>
          <p className="text-sm text-muted-foreground">
            {totalAllocation === 100 ? 'Allocations sum to 100%' : `Allocations should sum to 100% (currently ${totalAllocation}%)`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asset Classes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : classes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No asset classes defined. Click &quot;Add Asset Class&quot; to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Target Allocation</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map(assetClass => (
                  <TableRow key={assetClass.id}>
                    <TableCell className="font-medium">{assetClass.name}</TableCell>
                    <TableCell>{assetClass.description || '-'}</TableCell>
                    <TableCell className="text-right">{assetClass.target_allocation}%</TableCell>
                    <TableCell>{assetClass.display_order}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(assetClass)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(assetClass.id)}
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
              {editingClass ? 'Edit Asset Class' : 'Add Asset Class'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., US Large Cap"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="e.g., Large-cap US equities"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="target_allocation">Target Allocation (%)</Label>
                  <Input
                    id="target_allocation"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.target_allocation}
                    onChange={e => setFormData({ ...formData, target_allocation: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={e => setFormData({ ...formData, display_order: e.target.value })}
                  />
                </div>
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
