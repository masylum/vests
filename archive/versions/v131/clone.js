// Game state contains only arrays and plain objects. Preserve shared references,
// undefined values and non-finite numbers without native serialization overhead.
export function clone(value) {
  const seen = new Map();
  function copy(value) {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const result = Array.isArray(value) ? new Array(value.length) : {};
    seen.set(value, result);
    for (const key of Object.keys(value)) result[key] = copy(value[key]);
    return result;
  }
  return copy(value);
}
