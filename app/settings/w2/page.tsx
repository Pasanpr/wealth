'use client'

import { useState, useEffect } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import { W2Form, W2Box12Item, W2Box14Item, W2_BOX_12_CODES } from '@/lib/types'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type FormState = {
  year: number
  employer_name: string
  employer_ein: string
  wages_tips_compensation: string
  federal_income_tax_withheld: string
  social_security_wages: string
  social_security_tax_withheld: string
  medicare_wages: string
  medicare_tax_withheld: string
  social_security_tips: string
  allocated_tips: string
  dependent_care_benefits: string
  nonqualified_plans: string
  box_12_items: W2Box12Item[]
  is_statutory_employee: boolean
  has_retirement_plan: boolean
  has_third_party_sick_pay: boolean
  box_14_items: W2Box14Item[]
  state_code: string
  state_employer_id: string
  state_wages: string
  state_income_tax_withheld: string
  local_wages: string
  local_income_tax_withheld: string
  locality_name: string
  state_code_2: string
  state_employer_id_2: string
  state_wages_2: string
  state_income_tax_2: string
  notes: string
}

const emptyForm: FormState = {
  year: new Date().getFullYear() - 1,
  employer_name: '',
  employer_ein: '',
  wages_tips_compensation: '',
  federal_income_tax_withheld: '',
  social_security_wages: '',
  social_security_tax_withheld: '',
  medicare_wages: '',
  medicare_tax_withheld: '',
  social_security_tips: '',
  allocated_tips: '',
  dependent_care_benefits: '',
  nonqualified_plans: '',
  box_12_items: [],
  is_statutory_employee: false,
  has_retirement_plan: false,
  has_third_party_sick_pay: false,
  box_14_items: [],
  state_code: '',
  state_employer_id: '',
  state_wages: '',
  state_income_tax_withheld: '',
  local_wages: '',
  local_income_tax_withheld: '',
  locality_name: '',
  state_code_2: '',
  state_employer_id_2: '',
  state_wages_2: '',
  state_income_tax_2: '',
  notes: '',
}

export default function W2Page() {
  const [w2Forms, setW2Forms] = useState<W2Form[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [expandedW2, setExpandedW2] = useState<number | null>(null)

  useEffect(() => {
    fetchW2Forms()
  }, [])

  const fetchW2Forms = async () => {
    try {
      const res = await fetch('/api/w2')
      const data = await res.json()
      setW2Forms(data)
    } catch (error) {
      console.error('Failed to fetch W-2 forms:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        year: form.year,
        employer_name: form.employer_name,
        employer_ein: form.employer_ein || null,
        wages_tips_compensation: parseFloat(form.wages_tips_compensation) || 0,
        federal_income_tax_withheld: parseFloat(form.federal_income_tax_withheld) || 0,
        social_security_wages: parseFloat(form.social_security_wages) || 0,
        social_security_tax_withheld: parseFloat(form.social_security_tax_withheld) || 0,
        medicare_wages: parseFloat(form.medicare_wages) || 0,
        medicare_tax_withheld: parseFloat(form.medicare_tax_withheld) || 0,
        social_security_tips: parseFloat(form.social_security_tips) || 0,
        allocated_tips: parseFloat(form.allocated_tips) || 0,
        dependent_care_benefits: parseFloat(form.dependent_care_benefits) || 0,
        nonqualified_plans: parseFloat(form.nonqualified_plans) || 0,
        box_12_items: form.box_12_items,
        is_statutory_employee: form.is_statutory_employee,
        has_retirement_plan: form.has_retirement_plan,
        has_third_party_sick_pay: form.has_third_party_sick_pay,
        box_14_items: form.box_14_items,
        state_code: form.state_code || null,
        state_employer_id: form.state_employer_id || null,
        state_wages: parseFloat(form.state_wages) || 0,
        state_income_tax_withheld: parseFloat(form.state_income_tax_withheld) || 0,
        local_wages: parseFloat(form.local_wages) || 0,
        local_income_tax_withheld: parseFloat(form.local_income_tax_withheld) || 0,
        locality_name: form.locality_name || null,
        state_code_2: form.state_code_2 || null,
        state_employer_id_2: form.state_employer_id_2 || null,
        state_wages_2: parseFloat(form.state_wages_2) || 0,
        state_income_tax_2: parseFloat(form.state_income_tax_2) || 0,
        notes: form.notes || null,
      }

      const res = await fetch('/api/w2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Save failed')

      await fetchW2Forms()
      setForm(emptyForm)
      setEditingId(null)
      setShowAdvanced(false)
    } catch (error) {
      console.error('Failed to save W-2:', error)
      alert('Failed to save W-2')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (w2: W2Form) => {
    setForm({
      year: w2.year,
      employer_name: w2.employer_name,
      employer_ein: w2.employer_ein || '',
      wages_tips_compensation: w2.wages_tips_compensation.toString(),
      federal_income_tax_withheld: w2.federal_income_tax_withheld.toString(),
      social_security_wages: w2.social_security_wages.toString(),
      social_security_tax_withheld: w2.social_security_tax_withheld.toString(),
      medicare_wages: w2.medicare_wages.toString(),
      medicare_tax_withheld: w2.medicare_tax_withheld.toString(),
      social_security_tips: w2.social_security_tips?.toString() || '',
      allocated_tips: w2.allocated_tips?.toString() || '',
      dependent_care_benefits: w2.dependent_care_benefits?.toString() || '',
      nonqualified_plans: w2.nonqualified_plans?.toString() || '',
      box_12_items: w2.box_12_items || [],
      is_statutory_employee: w2.is_statutory_employee,
      has_retirement_plan: w2.has_retirement_plan,
      has_third_party_sick_pay: w2.has_third_party_sick_pay,
      box_14_items: w2.box_14_items || [],
      state_code: w2.state_code || '',
      state_employer_id: w2.state_employer_id || '',
      state_wages: w2.state_wages?.toString() || '',
      state_income_tax_withheld: w2.state_income_tax_withheld?.toString() || '',
      local_wages: w2.local_wages?.toString() || '',
      local_income_tax_withheld: w2.local_income_tax_withheld?.toString() || '',
      locality_name: w2.locality_name || '',
      state_code_2: w2.state_code_2 || '',
      state_employer_id_2: w2.state_employer_id_2 || '',
      state_wages_2: w2.state_wages_2?.toString() || '',
      state_income_tax_2: w2.state_income_tax_2?.toString() || '',
      notes: w2.notes || '',
    })
    setEditingId(w2.id)
    setShowAdvanced(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this W-2?')) return

    try {
      const res = await fetch(`/api/w2/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      await fetchW2Forms()
    } catch (error) {
      console.error('Failed to delete W-2:', error)
      alert('Failed to delete W-2')
    }
  }

  const addBox12Item = () => {
    setForm(prev => ({
      ...prev,
      box_12_items: [...prev.box_12_items, { code: '', amount: 0 }],
    }))
  }

  const updateBox12Item = (index: number, field: 'code' | 'amount', value: string | number) => {
    setForm(prev => ({
      ...prev,
      box_12_items: prev.box_12_items.map((item, i) =>
        i === index ? { ...item, [field]: field === 'amount' ? parseFloat(value as string) || 0 : value } : item
      ),
    }))
  }

  const removeBox12Item = (index: number) => {
    setForm(prev => ({
      ...prev,
      box_12_items: prev.box_12_items.filter((_, i) => i !== index),
    }))
  }

  const addBox14Item = () => {
    setForm(prev => ({
      ...prev,
      box_14_items: [...prev.box_14_items, { description: '', amount: 0 }],
    }))
  }

  const updateBox14Item = (index: number, field: 'description' | 'amount', value: string | number) => {
    setForm(prev => ({
      ...prev,
      box_14_items: prev.box_14_items.map((item, i) =>
        i === index ? { ...item, [field]: field === 'amount' ? parseFloat(value as string) || 0 : value } : item
      ),
    }))
  }

  const removeBox14Item = (index: number) => {
    setForm(prev => ({
      ...prev,
      box_14_items: prev.box_14_items.filter((_, i) => i !== index),
    }))
  }

  // Get RSU income from Box 12 code V
  const getRsuIncome = (w2: W2Form) => {
    const rsuItem = w2.box_12_items?.find(item => item.code === 'V')
    return rsuItem?.amount || 0
  }

  return (
    <PageContainer
      title="W-2 Forms"
      description="Manage your W-2 wage and tax statements"
      actions={
        <Link href="/settings">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit W-2' : 'Add W-2'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Tax Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={form.year}
                    onChange={e => setForm({ ...form, year: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employer_name">Employer Name</Label>
                  <Input
                    id="employer_name"
                    value={form.employer_name}
                    onChange={e => setForm({ ...form, employer_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Box 1-2: Wages and Federal Tax */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wages">1. Wages, tips, compensation</Label>
                  <Input
                    id="wages"
                    type="number"
                    step="0.01"
                    value={form.wages_tips_compensation}
                    onChange={e => setForm({ ...form, wages_tips_compensation: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="federal_tax">2. Federal income tax withheld</Label>
                  <Input
                    id="federal_tax"
                    type="number"
                    step="0.01"
                    value={form.federal_income_tax_withheld}
                    onChange={e => setForm({ ...form, federal_income_tax_withheld: e.target.value })}
                  />
                </div>
              </div>

              {/* Box 3-6: Social Security and Medicare */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ss_wages">3. Social security wages</Label>
                  <Input
                    id="ss_wages"
                    type="number"
                    step="0.01"
                    value={form.social_security_wages}
                    onChange={e => setForm({ ...form, social_security_wages: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ss_tax">4. Social security tax withheld</Label>
                  <Input
                    id="ss_tax"
                    type="number"
                    step="0.01"
                    value={form.social_security_tax_withheld}
                    onChange={e => setForm({ ...form, social_security_tax_withheld: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="medicare_wages">5. Medicare wages</Label>
                  <Input
                    id="medicare_wages"
                    type="number"
                    step="0.01"
                    value={form.medicare_wages}
                    onChange={e => setForm({ ...form, medicare_wages: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medicare_tax">6. Medicare tax withheld</Label>
                  <Input
                    id="medicare_tax"
                    type="number"
                    step="0.01"
                    value={form.medicare_tax_withheld}
                    onChange={e => setForm({ ...form, medicare_tax_withheld: e.target.value })}
                  />
                </div>
              </div>

              {/* State Tax Info */}
              <div className="pt-2 border-t">
                <div className="text-sm font-medium text-muted-foreground mb-3">State Tax Information</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state_code">15. State</Label>
                    <Input
                      id="state_code"
                      value={form.state_code}
                      onChange={e => setForm({ ...form, state_code: e.target.value.toUpperCase() })}
                      placeholder="CA"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state_wages">16. State wages</Label>
                    <Input
                      id="state_wages"
                      type="number"
                      step="0.01"
                      value={form.state_wages}
                      onChange={e => setForm({ ...form, state_wages: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state_tax">17. State tax withheld</Label>
                    <Input
                      id="state_tax"
                      type="number"
                      step="0.01"
                      value={form.state_income_tax_withheld}
                      onChange={e => setForm({ ...form, state_income_tax_withheld: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Advanced Options (Box 12, Box 14, etc.)
              </button>

              {showAdvanced && (
                <div className="space-y-4 pl-4 border-l-2 border-muted">
                  {/* Box 12 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>12. Coded Items</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addBox12Item}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {form.box_12_items.map((item, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="w-20">
                          <Input
                            value={item.code}
                            onChange={e => updateBox12Item(index, 'code', e.target.value.toUpperCase())}
                            placeholder="Code"
                            maxLength={2}
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={e => updateBox12Item(index, 'amount', e.target.value)}
                            placeholder="Amount"
                          />
                        </div>
                        <div className="flex-1 text-xs text-muted-foreground pt-2">
                          {W2_BOX_12_CODES[item.code] || ''}
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeBox12Item(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Common codes: D (401k), DD (Health), V (RSU Income), W (HSA), AA (Roth 401k)
                    </p>
                  </div>

                  {/* Box 14 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>14. Other</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addBox14Item}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {form.box_14_items.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            value={item.description}
                            onChange={e => updateBox14Item(index, 'description', e.target.value)}
                            placeholder="Description"
                          />
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={e => updateBox14Item(index, 'amount', e.target.value)}
                            placeholder="Amount"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeBox14Item(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Box 13 Checkboxes */}
                  <div className="space-y-2">
                    <Label>13. Checkboxes</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.has_retirement_plan}
                          onChange={e => setForm({ ...form, has_retirement_plan: e.target.checked })}
                        />
                        Retirement plan
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_statutory_employee}
                          onChange={e => setForm({ ...form, is_statutory_employee: e.target.checked })}
                        />
                        Statutory employee
                      </label>
                    </div>
                  </div>

                  {/* Employer EIN */}
                  <div className="space-y-2">
                    <Label htmlFor="employer_ein">Employer EIN</Label>
                    <Input
                      id="employer_ein"
                      value={form.employer_ein}
                      onChange={e => setForm({ ...form, employer_ein: e.target.value })}
                      placeholder="XX-XXXXXXX"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving || !form.employer_name}>
                  {saving ? 'Saving...' : editingId ? 'Update W-2' : 'Save W-2'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForm(emptyForm)
                      setEditingId(null)
                      setShowAdvanced(false)
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Saved W-2s */}
        <Card>
          <CardHeader>
            <CardTitle>Saved W-2 Forms</CardTitle>
          </CardHeader>
          <CardContent>
            {w2Forms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No W-2 forms saved yet.</p>
            ) : (
              <div className="space-y-4">
                {w2Forms.map(w2 => (
                  <div key={w2.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{w2.year} - {w2.employer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Wages: {formatCurrency(w2.wages_tips_compensation)}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(w2)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(w2.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedW2(expandedW2 === w2.id ? null : w2.id)}
                      className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1"
                    >
                      {expandedW2 === w2.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Details
                    </button>

                    {expandedW2 === w2.id && (
                      <div className="mt-3 pt-3 border-t text-sm grid grid-cols-2 gap-2">
                        <div>Federal Tax: <strong>{formatCurrency(w2.federal_income_tax_withheld)}</strong></div>
                        <div>SS Tax: <strong>{formatCurrency(w2.social_security_tax_withheld)}</strong></div>
                        <div>Medicare Tax: <strong>{formatCurrency(w2.medicare_tax_withheld)}</strong></div>
                        {w2.state_code && (
                          <div>{w2.state_code} Tax: <strong>{formatCurrency(w2.state_income_tax_withheld)}</strong></div>
                        )}
                        {getRsuIncome(w2) > 0 && (
                          <div className="col-span-2 pt-2 border-t mt-2">
                            <span className="text-muted-foreground">RSU Income (Box 12 V):</span>{' '}
                            <strong>{formatCurrency(getRsuIncome(w2))}</strong>
                          </div>
                        )}
                        {w2.box_12_items && w2.box_12_items.length > 0 && (
                          <div className="col-span-2 pt-2">
                            <div className="text-muted-foreground mb-1">Box 12:</div>
                            {w2.box_12_items.map((item, i) => (
                              <div key={i} className="text-xs">
                                {item.code}: {formatCurrency(item.amount)}
                                <span className="text-muted-foreground ml-1">
                                  ({W2_BOX_12_CODES[item.code] || 'Unknown'})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="col-span-2 pt-2 border-t mt-2">
                          <span className="text-muted-foreground">Effective Tax Rate:</span>{' '}
                          <strong>
                            {((w2.federal_income_tax_withheld + w2.state_income_tax_withheld) / w2.wages_tips_compensation * 100).toFixed(1)}%
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
