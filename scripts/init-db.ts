import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'wealth.db')
const MIGRATIONS_DIR = path.join(process.cwd(), 'lib', 'db', 'migrations')

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
  console.log('Created data directory')
}

// Initialize database
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log(`Database initialized at ${DB_PATH}`)

// Run migrations
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort()

for (const file of migrationFiles) {
  const filePath = path.join(MIGRATIONS_DIR, file)
  const sql = fs.readFileSync(filePath, 'utf-8')

  console.log(`Running migration: ${file}`)
  db.exec(sql)
  console.log(`Completed migration: ${file}`)
}

// Verify tables
const tables = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all() as { name: string }[]

console.log('\nCreated tables:')
tables.forEach(t => console.log(`  - ${t.name}`))

// Verify account types
const accountTypes = db.prepare('SELECT code, name FROM account_types').all() as { code: string; name: string }[]
console.log('\nAccount types:')
accountTypes.forEach(t => console.log(`  - ${t.code}: ${t.name}`))

db.close()
console.log('\nDatabase initialization complete!')
