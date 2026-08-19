// NexCargo MOD-011 Domain Utils — Mobile Payload Optimization Patterns
// Authoritative source: MOD-011 §3.1.1 (Mobile-Optimized API Design) + §7.8 (Mobile Payload Rule)
// Implements exit criteria X-05: field filtering, aggregation endpoints, pagination, ETag/Last-Modified, compression patterns

/**
 * Applies field filtering to an object based on requested fields query parameter.
 * Per MOD-011 §7.8: Field selection MUST be supported via query parameters.
 * @param obj - Source object to filter
 * @param fields - Array of field names to include (empty = no filtering)
 * @returns Filtered object containing only requested fields
 */
export function applyFieldFilter<T extends Record<string, unknown>>(
  obj: T,
  fields?: string[]
): Partial<T> {
  if (!fields || fields.length === 0) {
    return { ...obj };
  }
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in obj) {
      (result as Record<string, unknown>)[field] = obj[field];
    }
  }
  return result;
}

/**
 * Calculates pagination metadata for a paginated response.
 * Per MOD-011 §3.1.1: Response pagination MUST be implemented for lists.
 * @param total - Total number of items
 * @param page - Current page number (1-based)
 * @param limit - Items per page
 * @returns PaginatedResponse with data slice and metadata
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, total);
  const pageData = data.slice(startIndex, endIndex);

  return {
    data: pageData,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Generates an ETag hash for cache validation.
 * Per MOD-011 §7.8: APIs MUST support conditional requests (ETag, Last-Modified).
 * @param content - Content string to hash
 * @returns Hex-encoded SHA-256 hash as ETag value
 */
export async function generateETag(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Flattens nested objects into a single-level object by joining keys with dots.
 * Per MOD-011 §7.8: Nested objects MUST be flattenable on request.
 * @param obj - Object to flatten
 * @param prefix - Key prefix for recursion
 * @returns Flattened object
 */
export function flattenObject(obj: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}
