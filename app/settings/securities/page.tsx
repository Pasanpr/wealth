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
import { SecurityWithAssetClass, AssetClass } from '@/lib/types'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function SecuritiesPage() {
  const [securities, setSecurities] = useState<SecurityWithAssetClass[]>([])
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSecurity, setEditingSecurity] = useState<SecurityWithAssetClass | null>(null)
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    description: '',
    asset_class_id: '',
  })

  const fetchData = async () => {
    try {
      const [securitiesRes, classesRes] = await Promise.all([
        fetch('/api/securities'),
        fetch('/api/asset-classes'),
      ])
      const securitiesData = await securitiesRes.json()
      const classesData = await classesRes.json()
      setSecurities(securitiesData)
      setAssetClasses(classesData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      symbol: formData.symbol,
      name: formData.name,
      description: formData.description || null,
      asset_class_id: formData.asset_class_id ? parseInt(formData.asset_class_id) : null,
    }

    try {
      if (editingSecurity) {
        await fetch(`/api/securities/${editingSecurity.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/securities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setDialogOpen(false)
      setEditingSecurity(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Failed to save security:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      symbol: '',
      name: '',
      description: '',
      asset_class_id: '',
    })
  }

  const handleEdit = (security: SecurityWithAssetClass) => {
    setEditingSecurity(security)
    setFormData({
      symbol: security.symbol,
      name: security.name,
      description: security.description || '',
      asset_class_id: security.asset_class_id?.toString() || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this security?')) return

    try {
      await fetch(`/api/securities/${id}`, { method: 'DELETE' })
      fetchData()
    } catch (error) {
      console.error('Failed to delete security:', error)
    }
  }

  const openNewDialog = () => {
    setEditingSecurity(null)
    resetForm()
    setDialogOpen(true)
  }

  return (
    <PageContainer
      title="Securities"
      description="Manage funds, ETFs, and stocks for portfolio tracking"
      actions={
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Security
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Securities</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : securities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No securities defined. Click &quot;Add Security&quot; to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Asset Class</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {securities.map(security => (
                  <TableRow key={security.id}>
                    <TableCell className="font-medium">{security.symbol}</TableCell>
                    <TableCell>{security.name}</TableCell>
                    <TableCell>{security.asset_class_name || '-'}</TableCell>
                    <TableCell>{security.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(security)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(security.id)}
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
              {editingSecurity ? 'Edit Security' : 'Add Security'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  placeholder="e.g., VTSAX, VTI"
                  value={formData.symbol}
                  onChange={e => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Vanguard Total Stock Market Index Fund"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset_class_id">Asset Class</Label>
                <Select
                  value={formData.asset_class_id || 'none'}
                  onValueChange={value => setFormData({ ...formData, asset_class_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset class (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {assetClasses.map(ac => (
                      <SelectItem key={ac.id} value={ac.id.toString()}>
                        {ac.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
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
