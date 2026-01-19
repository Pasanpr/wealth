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
import { AccountWithType, AccountType } from '@/lib/types'
import { Plus, Pencil, Trash2, Briefcase } from 'lucide-react'
import Link from 'next/link'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithType[]>([])
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountWithType | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    account_type_id: '',
    institution: '',
    beneficiary: '',
    notes: '',
  })

  const fetchData = async () => {
    try {
      const [accountsRes, typesRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/account-types'),
      ])
      const accountsData = await accountsRes.json()
      const typesData = await typesRes.json()
      setAccounts(accountsData)
      setAccountTypes(typesData)
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
      ...formData,
      account_type_id: parseInt(formData.account_type_id),
    }

    try {
      if (editingAccount) {
        await fetch(`/api/accounts/${editingAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, is_active: true }),
        })
      } else {
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setDialogOpen(false)
      setEditingAccount(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Failed to save account:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      account_type_id: '',
      institution: '',
      beneficiary: '',
      notes: '',
    })
  }

  const handleEdit = (account: AccountWithType) => {
    setEditingAccount(account)
    setFormData({
      name: account.name,
      account_type_id: account.account_type_id.toString(),
      institution: account.institution || '',
      beneficiary: account.beneficiary || '',
      notes: account.notes || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account? This will also delete all holdings and cash flows for this account.')) return

    try {
      await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      fetchData()
    } catch (error) {
      console.error('Failed to delete account:', error)
    }
  }

  const openNewDialog = () => {
    setEditingAccount(null)
    resetForm()
    setDialogOpen(true)
  }

  return (
    <PageContainer
      title="Investment Accounts"
      description="Manage your brokerage, retirement, and education savings accounts"
      actions={
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>All Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No accounts yet. Click &quot;Add Account&quot; to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Tax Advantaged</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(account => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/portfolio/accounts/${account.id}`}
                        className="hover:underline"
                      >
                        {account.name}
                      </Link>
                    </TableCell>
                    <TableCell>{account.account_type_name}</TableCell>
                    <TableCell>{account.institution || '-'}</TableCell>
                    <TableCell>{account.beneficiary || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        account.is_tax_advantaged
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {account.is_tax_advantaged ? 'Yes' : 'No'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(account)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(account.id)}
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
              {editingAccount ? 'Edit Account' : 'Add Account'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Fidelity Brokerage"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account_type_id">Account Type</Label>
                <Select
                  value={formData.account_type_id}
                  onValueChange={value => setFormData({ ...formData, account_type_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map(type => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="institution">Institution</Label>
                <Input
                  id="institution"
                  placeholder="e.g., Fidelity, Vanguard"
                  value={formData.institution}
                  onChange={e => setFormData({ ...formData, institution: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="beneficiary">Beneficiary (for 529 accounts)</Label>
                <Input
                  id="beneficiary"
                  value={formData.beneficiary}
                  onChange={e => setFormData({ ...formData, beneficiary: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
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
