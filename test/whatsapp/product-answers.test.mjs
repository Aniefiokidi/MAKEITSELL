import assert from 'node:assert/strict'
import test from 'node:test'
import { answerProductQuestion, selectProductVariants } from '../../lib/whatsapp/product-answers.ts'

const product = {
  name: 'Running Shoes',
  price: 18000,
  status: 'active',
  stock: 3,
  variants: [
    { label: 'Size', value: '42', stock: 2 },
    { label: 'Size', value: '43', stock: 0 },
  ],
}

test('answers price and availability from listing facts', () => {
  assert.match(answerProductQuestion(product, 'how much is it?'), /NGN 18,000/)
  assert.match(answerProductQuestion(product, 'is it in stock?'), /3 units in stock/)
})

test('shows only variants with stock', () => {
  const reply = answerProductQuestion(product, 'what sizes?')
  assert.match(reply, /Size: 42/)
  assert.doesNotMatch(reply, /43/)
})

test('does not promise an unavailable item', () => {
  assert.match(answerProductQuestion({ ...product, stock: 0 }, 'available?'), /unavailable/)
  assert.match(answerProductQuestion(product, 'is size 43 available?'), /out of stock/)
  assert.match(answerProductQuestion(product, 'is size 42 available?'), /2 units in stock/)
})

test('requires a choice when multiple values exist', () => {
  const options = [
    { label: 'Size', value: '42', stock: 2 },
    { label: 'Size', value: '43', stock: 1 },
    { label: 'Color', value: 'Red', stock: 2 },
    { label: 'Color', value: 'Blue', stock: 0 },
  ]
  assert.match(selectProductVariants('Shoes', options, '', 1).prompt, /Choose Size/)
  assert.deepEqual(selectProductVariants('Shoes', options, 'size 42 color red', 1).selected, [
    { label: 'Size', value: '42' },
    { label: 'Color', value: 'Red' },
  ])
  assert.match(selectProductVariants('Shoes', options, 'size 43 color red', 2).prompt, /Only 1/)
  assert.match(selectProductVariants('Shoes', options, 'size 42 color blue', 1).prompt, /out of stock/)
})
