export function regionKey(city: string, county: string): string {
  return `${city}|${county}`
}

export function regionLabel(city: string, county: string): string {
  const cityPart = city.replace(/市$/, '')
  const countyPart = county.replace(/市辖区$/, '').replace(/区$/, '').replace(/县$/, '')
  return `${cityPart}${countyPart}` || county || city || '未分区'
}

export function locationLine(city: string, county: string, name: string, extra = ''): string {
  const place = ['辽宁省', city, county, extra.trim()].filter(Boolean).join('')
  const normalized = place.startsWith('辽宁省辽宁省') ? place.slice(3) : place
  return name ? `${normalized}·${name}` : normalized
}

export function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

export function matchesQuery(haystack: string, query: string): boolean {
  const needle = compact(query)
  if (!needle) return true
  return compact(haystack).includes(needle)
}
