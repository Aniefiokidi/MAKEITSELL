#!/usr/bin/env node
/**
 * One-time migration: set stock = 9999 for all Food & Beverages products
 * that currently have stock = 0 (made to order, never tracked stock).
 *
 * Usage: node scripts/migrate-food-products-stock.js
 */

const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(path.join(__dirname, '../.env.local'))
loadEnvFile(path.join(__dirname, '../.env'))

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set')
  process.exit(1)
}

async function main() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  console.log('Connected to MongoDB')

  const db = client.db()
  const products = db.collection('products')

  // Count affected documents first
  const count = await products.countDocuments({
    category: 'Food & Beverages',
    stock: { $in: [0, null] }
  })
  console.log(`Found ${count} Food & Beverages products with stock 0 or null`)

  if (count === 0) {
    console.log('Nothing to update.')
    await client.close()
    return
  }

  const result = await products.updateMany(
    { category: 'Food & Beverages', stock: { $in: [0, null] } },
    { $set: { stock: 9999, updatedAt: new Date() } }
  )

  console.log(`Updated ${result.modifiedCount} products to stock: 9999`)
  await client.close()
  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
