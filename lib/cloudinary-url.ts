// Cloudinary serves images exactly as uploaded unless the URL requests a transform.
// This inserts q_auto/f_auto (+ an optional width cap) into any Cloudinary delivery
// URL so images are auto-compressed and served in a modern format (webp/avif) on the
// fly — no re-upload needed. Non-Cloudinary URLs (local /public assets, external
// placeholders) pass through untouched.
export function optimizedImageUrl(url: string | undefined | null, options: { width?: number } = {}): string {
  if (!url) return ''
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  // Already carries our transform (e.g. branding assets already using q_auto/f_auto) —
  // don't stack a second one.
  if (url.includes('q_auto')) return url

  const { width } = options
  const transformParts = ['q_auto', 'f_auto']
  if (width) transformParts.push(`w_${width}`, 'c_limit')

  return url.replace('/upload/', `/upload/${transformParts.join(',')}/`)
}
