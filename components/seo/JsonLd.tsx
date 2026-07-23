// Escapes "<" so a title/description containing "</script>" can't break out of the
// script tag — JSON.stringify alone doesn't do this since '<' is a perfectly valid
// character inside a JSON string.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
