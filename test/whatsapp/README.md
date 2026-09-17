# WhatsApp bot tests

```
sh test/whatsapp/run.sh
```

- `*.test.mjs` — pure unit tests for intent/query parsing (no database).
- `scenarios/` — end-to-end conversations. `harness.mjs` boots an in-memory MongoDB,
  `loader.mjs` resolves `@/` imports and swaps `lib/whatsapp/client.ts` for
  `stub-client.mjs`, which records every message the bot would send. Tests seed
  vendors/products/services, call `say("...")`, and assert on the replies.
- `scenarios/probe.mjs` — not a test: prints the bot's replies to a list of messages
  (`node --import ./test/whatsapp/scenarios/register.mjs test/whatsapp/scenarios/probe.mjs "your message"`)
  for eyeballing new phrasings before writing a test.

Services are contact-only on WhatsApp: the bot finds the providers closest to the buyer
and sends contact details plus an estimated rate. `scenarios/services.test.mjs` is the
spec for that.
