import assert from 'node:assert/strict'
import test from 'node:test'
import { findPlaceInText } from '../../../lib/geo-utils.ts'
import { answerBuyerFaq } from '../../../lib/whatsapp/buyer-faq.ts'
import { parseCatalogQuery } from '../../../lib/whatsapp/catalog-query.ts'

test('places are found inside free text, longest match first, aliases only when whole', () => {
  assert.equal(findPlaceInText('I am in wuse 2')?.name, 'Wuse')
  assert.equal(findPlaceInText('port harcourt')?.name, 'Port Harcourt')
  assert.equal(findPlaceInText('PH')?.name, 'Port Harcourt')
  assert.equal(findPlaceInText('I need a photographer'), null)
  assert.equal(findPlaceInText('Ikeja, Lagos')?.name, 'Ikeja')
  assert.equal(findPlaceInText('Rivers state')?.state, 'Rivers')
})

test('FAQ answers cover delivery, payment, returns and support but not product names', () => {
  assert.equal(answerBuyerFaq('do you deliver to Kano?')?.kind, 'text')
  assert.equal(answerBuyerFaq('can I pay on delivery')?.kind, 'text')
  assert.equal(answerBuyerFaq('refund policy')?.kind, 'text')
  assert.equal(answerBuyerFaq('talk to a person')?.kind, 'text')
  assert.equal(answerBuyerFaq('what do you sell?')?.kind, 'categories')
  assert.equal(answerBuyerFaq('ok')?.kind, 'text')
  assert.equal(answerBuyerFaq('sneakers'), null)
  assert.equal(answerBuyerFaq('I need someone to fix my generator in Yaba'), null)
  assert.equal(answerBuyerFaq('tech support services'), null)
  assert.equal(answerBuyerFaq('phone case'), null)
})

test('sizes are split out of the search term', () => {
  assert.deepEqual(parseCatalogQuery('sneakers size 42'), { term: 'sneakers', size: '42' })
  assert.deepEqual(parseCatalogQuery('red sneakers UK 8 under 20k'), { term: 'red sneakers', maxPrice: 20000, size: 'UK 8' })
  assert.deepEqual(parseCatalogQuery('shirt size XL'), { term: 'shirt', size: 'XL' })
  assert.deepEqual(parseCatalogQuery('iphone 13 case'), { term: 'iphone 13 case' })
})
