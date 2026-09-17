# Isolated purchase-protection tests

Run `npm install --ignore-scripts` then `npm test` from this directory.

The test harness compiles the actual financial implementation and order/product/store/wallet-transaction schemas. Financial tests substitute the database connector, referral side effects and a minimal wallet user schema, and uses a disposable MongoDB replica set. No production credentials or database are loaded. The first run downloads a MongoDB binary and needs network access and a local port.

Deployment must preserve MongoDB transaction support and unique wallet transaction references. Existing signed Shipbubble/Fez callbacks start the 48-hour holds. Admin verifies unsupported/historical delivery evidence. Return labels, courier receipts and original-payment refund references are entered after staff perform and verify those operations with the relevant provider. Those external operations are not automatically executed by the case forms.

The 33 tests also exercise the actual after-sales GET/POST handlers, including permission checks and a complete return-to-wallet-refund journey, plus the automatic Paystack refund path: intent recording, the request made outside the transaction, `refund.processed`/`refund.failed` outcomes via the real webhook handler (signature-verified), idempotent duplicate delivery, amount-mismatch refusal, vendor-debit reversal, and the reconciler escalating an unconfirmed intent without re-requesting it. The real `paystack-refund.ts` client is compiled; only `fetch` is stubbed at the network edge. Route tests substitute authentication resolution, rate limiting, email delivery and the Next response wrapper. Real HTTP authentication, a live Paystack refund and native device journeys remain separate release checks.
