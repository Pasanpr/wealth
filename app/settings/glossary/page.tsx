'use client'

import { useState, useMemo } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { glossary, categoryLabels, GlossaryEntry } from '@/lib/glossary'
import { Search, BookOpen } from 'lucide-react'

type Category = GlossaryEntry['category']

export default function GlossaryPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all')

  const categories: (Category | 'all')[] = ['all', 'investing', 'accounts', 'returns', 'taxes', 'cash']

  const filteredTerms = useMemo(() => {
    const entries = Object.values(glossary)

    return entries
      .filter(entry => {
        // Filter by category
        if (selectedCategory !== 'all' && entry.category !== selectedCategory) {
          return false
        }

        // Filter by search
        if (search) {
          const lowerSearch = search.toLowerCase()
          return (
            entry.term.toLowerCase().includes(lowerSearch) ||
            entry.definition.toLowerCase().includes(lowerSearch)
          )
        }

        return true
      })
      .sort((a, b) => a.term.localeCompare(b.term))
  }, [search, selectedCategory])

  // Group filtered terms by category for display
  const groupedTerms = useMemo(() => {
    const groups: Record<Category, GlossaryEntry[]> = {
      investing: [],
      accounts: [],
      returns: [],
      taxes: [],
      cash: [],
    }

    filteredTerms.forEach(entry => {
      groups[entry.category].push(entry)
    })

    return groups
  }, [filteredTerms])

  return (
    <PageContainer
      title="Financial Glossary"
      description="Plain-language explanations of financial terms used in this app"
    >
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search terms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat === 'all' ? 'All' : categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        Showing {filteredTerms.length} term{filteredTerms.length !== 1 ? 's' : ''}
      </p>

      {/* Terms grouped by category */}
      {selectedCategory === 'all' ? (
        // Show all categories with headers
        Object.entries(groupedTerms).map(([category, terms]) => {
          if (terms.length === 0) return null

          return (
            <div key={category} className="mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {categoryLabels[category as Category]}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {terms.map((entry) => (
                  <TermCard key={entry.term} entry={entry} />
                ))}
              </div>
            </div>
          )
        })
      ) : (
        // Show single category
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTerms.map((entry) => (
            <TermCard key={entry.term} entry={entry} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {filteredTerms.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No terms found matching &quot;{search}&quot;
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}

function TermCard({ entry }: { entry: GlossaryEntry }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{entry.term}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {entry.definition}
        </p>
        {entry.example && (
          <p className="text-sm text-muted-foreground/80 mt-3 pt-3 border-t border-border/50 italic">
            Example: {entry.example}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
