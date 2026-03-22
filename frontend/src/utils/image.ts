const GENERIC_IMAGE_PATTERNS = [
  's.yimg.com',
  'yahoo_finance',
  'whirlpooldata/image/upload',
  'finnhub.io/file/finnhub/logo',
  'favicon',
  'default_image',
  'placeholder',
]

/**
 * Check if an image URL is a real article image (not a generic publisher logo).
 * Returns the URL if real, null if generic/missing.
 */
export function getRealImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const lower = url.toLowerCase()
  if (GENERIC_IMAGE_PATTERNS.some(p => lower.includes(p))) return null
  return url
}
