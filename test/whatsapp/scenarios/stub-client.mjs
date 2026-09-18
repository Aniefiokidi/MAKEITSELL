// Drop-in replacement for lib/whatsapp/client.ts used by the scenario tests. Every send
// is pushed onto `outbox` with a fake Meta-style message id so reply-to-card flows
// (WhatsAppProductMessageMap etc.) behave exactly as in production.
export const outbox = []
let counter = 0
function record(entry) {
  const id = `wamid.test.${++counter}`
  outbox.push({ id, ...entry })
  return { messages: [{ id }] }
}
export function resetOutbox() { outbox.length = 0 }
export async function getBotDisplayPhoneNumber() { return '2340000000000' }
export async function sendTemplateMessage(to, templateName, params) { return record({ to, kind: 'template', templateName, params, body: `[template:${templateName}] ${(params || []).join(' | ')}` }) }
export async function sendTextMessage(to, body) { return record({ to, kind: 'text', body: String(body) }) }
export async function sendImageMessage(to, imageUrl, caption) { return record({ to, kind: 'image', imageUrl, body: String(caption) }) }
export async function sendInteractiveListMessage(to, body, buttonText, sections, header, footer) {
  return record({ to, kind: 'list', body: String(body), buttonText, sections, header, footer })
}
export async function sendInteractiveButtons(to, body, buttons) {
  return record({ to, kind: 'buttons', body: String(body), buttons })
}
export const typingCalls = []
export async function sendReadAndTyping(messageId) { typingCalls.push(messageId) }
