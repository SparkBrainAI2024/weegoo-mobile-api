export function transformToEntityNameObjectFromId(
  obj: Record<string, unknown>,
  [key, alias]: [string, string],
): Record<string, unknown> {
  if (obj[key] != null && typeof obj[key] === 'object') {
    obj[alias] = obj[key];
    delete obj[key];
  }
  return obj;
}