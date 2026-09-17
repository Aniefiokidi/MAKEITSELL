import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCatalogQuery } from '../../lib/whatsapp/catalog-query.ts'

test('extracts explicit naira budgets without losing the item', () => {
  assert.deepEqual(parseCatalogQuery('sneakers under ₦20,000'), { term: 'sneakers', maxPrice: 20000 })
  assert.deepEqual(parseCatalogQuery('phone cases for below 15k'), { term: 'phone cases', maxPrice: 15000 })
  assert.deepEqual(parseCatalogQuery('bags up to NGN 1.5m'), { term: 'bags', maxPrice: 1500000 })
})

test('does not guess a budget from a vague request', () => {
  assert.deepEqual(parseCatalogQuery('cheap sneakers'), { term: 'cheap sneakers' })
  assert.deepEqual(parseCatalogQuery('sneakers under twenty thousand'), { term: 'sneakers under twenty thousand' })
})

test('recognizes a budget-only request so the bot can ask for an item', () => {
  assert.deepEqual(parseCatalogQuery('under 20k'), { term: '', maxPrice: 20000 })
})
