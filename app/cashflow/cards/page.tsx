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
import { CreditCard } from '@/lib/types'
import { Plus, Pencil, Trash2, CreditCard as CardIcon } from 'lucide-react'

export default function CreditCardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    issuer: '',
    last4: '',
    credit_limit: '',
    display_order: '0',
  })

  const fetchCards = async () => {
    try {
      const res = await fetch('/api/credit-cards')
      const data = await res.json()
      setCards(data)
    } catch (error) {
      console.error('Failed to fetch cards:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCards()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      ...formData,
      credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
      display_order: parseInt(formData.display_order) || 0,
    }

    try {
      if (editingCard) {
        await fetch(`/api/credit-cards/${editingCard.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, is_active: true }),
        })
      } else {
        await fetch('/api/credit-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setDialogOpen(false)
      setEditingCard(null)
      resetForm()
      fetchCards()
    } catch (error) {
      console.error('Failed to save card:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      issuer: '',
      last4: '',
      credit_limit: '',
      display_order: '0',
    })
  }

  const handleEdit = (card: CreditCard) => {
    setEditingCard(card)
    setFormData({
      name: card.name,
      issuer: card.issuer || '',
      last4: card.last4 || '',
      credit_limit: card.credit_limit?.toString() || '',
      display_order: card.display_order.toString(),
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this card? This will also delete all spending records for this card.')) return

    try {
      await fetch(`/api/credit-cards/${id}`, { method: 'DELETE' })
      fetchCards()
    } catch (error) {
      console.error('Failed to delete card:', error)
    }
  }

  const openNewDialog = () => {
    setEditingCard(null)
    resetForm()
    setDialogOpen(true)
  }

  return (
    <PageContainer
      title="Credit Cards"
      description="Manage your credit cards for spending tracking"
      actions={
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Card
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Your Credit Cards</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : cards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CardIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No credit cards yet. Click &quot;Add Card&quot; to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Last 4</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map(card => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">{card.name}</TableCell>
                    <TableCell>{card.issuer || '-'}</TableCell>
                    <TableCell>{card.last4 ? `****${card.last4}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      {card.credit_limit ? formatCurrency(card.credit_limit) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(card)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(card.id)}
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
              {editingCard ? 'Edit Credit Card' : 'Add Credit Card'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Card Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Chase Sapphire Reserve"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="issuer">Issuer</Label>
                <Input
                  id="issuer"
                  placeholder="e.g., Chase"
                  value={formData.issuer}
                  onChange={e => setFormData({ ...formData, issuer: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="last4">Last 4 Digits</Label>
                  <Input
                    id="last4"
                    maxLength={4}
                    placeholder="1234"
                    value={formData.last4}
                    onChange={e => setFormData({ ...formData, last4: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="credit_limit">Credit Limit</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    step="0.01"
                    value={formData.credit_limit}
                    onChange={e => setFormData({ ...formData, credit_limit: e.target.value })}
                  />
                </div>
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
