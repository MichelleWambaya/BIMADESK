let counter = 0;

/** Deterministic-ish id generator for the prototype's in-memory store.
 * A real backend would use UUIDs / DB-generated ids instead. */
export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
