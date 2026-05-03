export function serialize<T extends object>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(serialize) as unknown as T;
  }
  if (obj === null || typeof obj !== "object") return obj;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = val instanceof Date ? val.toISOString() : val !== null && typeof val === "object" ? serialize(val as object) : val;
  }
  return result as T;
}
