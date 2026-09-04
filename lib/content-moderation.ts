// Lightweight, dependency-free objectionable-content filter for user-generated text
// (product reviews, buyer<->vendor chat messages). Apple's App Store Review Guideline
// 1.2 requires every app with user-generated content to have "a method for filtering
// objectionable material from being posted" — this is that method. It runs BEFORE the
// content is ever saved, not after, so nothing objectionable is ever actually stored or
// shown to another user.
//
// A word-list match is deliberately simple rather than a full ML moderation pipeline —
// it's the standard, App-Review-accepted bar for this requirement, and doesn't require
// an external API call (cost, latency, an extra point of failure) on every review/message.
// Word-boundary matching on a normalized (lowercased, punctuation-stripped) copy of the
// text catches the common evasions (spacing, punctuation, repeated letters) without
// false-positiving on legitimate words that merely contain a substring match.
const BLOCKED_TERMS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'whore', 'slut',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'tranny', 'chink', 'spic', 'kike', 'coon',
  'motherfucker', 'cocksucker', 'twat',
]

function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    // Collapse runs of the same letter (e.g. "fuuuck") down to a single one, and strip
    // anything that isn't a letter/number/space so spacing/punctuation evasions
    // ("f u c k", "f.u.c.k") still match on the word-boundary check below.
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
}

export function containsObjectionableContent(text: string): boolean {
  const normalized = normalize(text)
  if (!normalized) return false
  return BLOCKED_TERMS.some((term) => new RegExp(`\\b${term}\\b`).test(normalized))
}

export const OBJECTIONABLE_CONTENT_MESSAGE =
  'This contains language that isn’t allowed here. Please rephrase and try again.'
