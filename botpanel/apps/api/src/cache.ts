/** Sehr einfacher Speicher-Cache mit Ablaufzeit (z. B. gegen Discord-Ratenlimits). */
export class TtlCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  constructor(private readonly ttlMs: number) {}

  async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await load();
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    return value;
  }

  delete(key: string) {
    this.store.delete(key);
  }
}
