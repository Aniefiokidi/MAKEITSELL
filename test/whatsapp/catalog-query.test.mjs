import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCatalogQuery } from '../../lib/whatsapp/catalog-query.ts'

test('extracts explicit naira budgets without losing the item', () => {
  assert.deepEqual(parseCatalogQuery('sneakers under ₦20,000'), { term: 'sneakers', maxPrice: 20000 })
  assert.deepEqual(parseCatalogQuery('phone cases for below 15k'), { term: 'phone cases', maxPrice: 15000 })
  assert.deepEqual(parseCatalogQuery('bags up to NGN 1.5m'), { term: 'bags', maxPrice: 1500000 })
})

test('does not guess a budget from a vague request', () => {
  assert.deepEqual(parseCatalogQuery('cheap sneakers'), { term: 'sneakers', sortByPrice: true })
  assert.deepEqual(parseCatalogQuery('sneakers under twenty thousand'), { term: 'sneakers under twenty thousand' })
})

test('recognizes a budget-only request so the bot can ask for an item', () => {
  assert.deepEqual(parseCatalogQuery('under 20k'), { term: '', maxPrice: 20000 })
})

test('price ranges and "around" set both bounds; purpose phrases are dropped', () => {
  assert.deepEqual(parseCatalogQuery('sneakers between 10k and 20k'), { term: 'sneakers', maxPrice: 20000, minPrice: 10000 })
  assert.deepEqual(parseCatalogQuery('sneakers 10k to 20k'), { term: 'sneakers', maxPrice: 20000, minPrice: 10000 })
  assert.deepEqual(parseCatalogQuery('sneakers around 10k'), { term: 'sneakers', maxPrice: 13000, minPrice: 7000 })
  assert.deepEqual(parseCatalogQuery('bags above 5k'), { term: 'bags', minPrice: 5000 })
  assert.deepEqual(parseCatalogQuery('sneakers for my son'), { term: 'sneakers' })
  assert.deepEqual(parseCatalogQuery('case for iphone 13'), { term: 'case for iphone 13' })
})
