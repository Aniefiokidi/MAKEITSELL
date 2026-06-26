#!/usr/bin/env node
/**
 * Export all stores to an Excel file, one sheet per state + one "All Stores" sheet.
 * Output: scripts/stores-export.xlsx
 *
 * Usage: node scripts/export-stores.js
 */

const fs = require('fs')
const path = require('path')
const dns = require('dns')
const { MongoClient } = require('mongodb')
const XLSX = require('xlsx')

// ── Env loading ───────────────────────────────────────────────────────────────
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1)
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnvFile(path.join(process.cwd(), '.env'))
loadEnvFile(path.join(process.cwd(), '.env.local'))

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || ''
if (!MONGO_URI) { console.error('ERROR: MONGODB_URI not set'); process.exit(1) }

async function connectMongo() {
  const configuredDns = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map(s => s.trim()).filter(Boolean)
  if (configuredDns.length) dns.setServers(configuredDns)
  const client = new MongoClient(MONGO_URI, { maxPoolSize: 5 })
  await client.connect()
  return client
}

function cleanStr(v) {
  return String(v || '').trim()
}

function colWidth(rows, key) {
  const max = rows.reduce((m, r) => Math.max(m, cleanStr(r[key]).length), key.length)
  return Math.min(Math.max(max + 2, 12), 60)
}

function buildSheet(rows) {
  if (!rows.length) {
    return XLSX.utils.aoa_to_sheet([['No stores in this category']])
  }

  const data = rows.map((r, i) => ({
    '#': i + 1,
    'Store Name': cleanStr(r.storeName),
    'Phone': cleanStr(r.phone),
    'Email': cleanStr(r.email),
    'Address': cleanStr(r.address),
    'City': cleanStr(r.city),
    'State': cleanStr(r.state),
    'Category': cleanStr(r.category),
    'Status': r.isOpen === false ? 'Closed' : 'Open',
  }))

  const ws = XLSX.utils.json_to_sheet(data)

  // Column widths
  ws['!cols'] = [
    { wch: 4 },
    { wch: colWidth(data, 'Store Name') },
    { wch: colWidth(data, 'Phone') },
    { wch: colWidth(data, 'Email') },
    { wch: colWidth(data, 'Address') },
    { wch: colWidth(data, 'City') },
    { wch: colWidth(data, 'State') },
    { wch: colWidth(data, 'Category') },
    { wch: 8 },
  ]

  return ws
}

async function main() {
  console.log('Connecting to MongoDB…')
  const client = await connectMongo()
  const db = client.db()

  try {
    const stores = await db.collection('stores')
      .find({})
      .project({ storeName: 1, phone: 1, email: 1, address: 1, city: 1, state: 1, category: 1, isOpen: 1 })
      .toArray()

    console.log(`Found ${stores.length} stores.`)

    // Group by state (normalise: trim + title-case)
    const grouped = new Map()
    for (const store of stores) {
      let state = cleanStr(store.state)
      if (!state) state = '(No State)'
      // title-case
      state = state.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      if (!grouped.has(state)) grouped.set(state, [])
      grouped.get(state).push(store)
    }

    // Sort states alphabetically, "(No State)" at end
    const sortedStates = [...grouped.keys()].sort((a, b) => {
      if (a === '(No State)') return 1
      if (b === '(No State)') return -1
      return a.localeCompare(b)
    })

    const wb = XLSX.utils.book_new()

    // All Stores sheet (sorted by state then store name)
    const allSorted = [...stores].sort((a, b) => {
      const sa = cleanStr(a.state) || 'zzz'
      const sb = cleanStr(b.state) || 'zzz'
      if (sa !== sb) return sa.localeCompare(sb)
      return cleanStr(a.storeName).localeCompare(cleanStr(b.storeName))
    })
    XLSX.utils.book_append_sheet(wb, buildSheet(allSorted), 'All Stores')

    // One sheet per state
    for (const state of sortedStates) {
      const rows = grouped.get(state).sort((a, b) =>
        cleanStr(a.storeName).localeCompare(cleanStr(b.storeName))
      )
      // Excel sheet names max 31 chars, strip invalid chars
      const sheetName = state.replace(/[:\\/?*[\]]/g, '').substring(0, 31)
      XLSX.utils.book_append_sheet(wb, buildSheet(rows), sheetName)
    }

    const outPath = path.join(process.cwd(), 'scripts', 'stores-export.xlsx')
    XLSX.writeFile(wb, outPath)

    console.log(`\nExport complete: ${outPath}`)
    console.log(`\nBreakdown by state:`)
    for (const state of sortedStates) {
      console.log(`  ${state.padEnd(30)} ${grouped.get(state).length} store(s)`)
    }
    console.log(`  ${'TOTAL'.padEnd(30)} ${stores.length}`)
  } finally {
    await client.close()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
