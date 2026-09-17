import assert from 'node:assert/strict'
import test from 'node:test'
import { requestedItem, splitShoppingList } from '../../lib/whatsapp/buyer-intent.ts'

test('extracts the item from common buying and price questions', () => {
  assert.equal(requestedItem('I want to buy red sneakers under 20k'), 'red sneakers under 20k')
  assert.equal(requestedItem('Do you have iPhone cases?'), 'iPhone cases')
  assert.equal(requestedItem('How much is a leather bag?'), 'leather bag')
})

test('does not guess at an unrelated question', () => {
  assert.equal(requestedItem('where is my order?'), null)
})

test('keeps thousands separators inside prices', () => {
  assert.deepEqual(splitShoppingList('sneakers under ₦20,000'), ['sneakers under ₦20,000'])
  assert.deepEqual(splitShoppingList('sneakers, phone cases'), ['sneakers', 'phone cases'])
})
