export class Cache {
	/**
	 * Sets a value in cache with TTL.
	 * @param key - Storage key.
	 * @param value - Any serializable value.
	 * @param ttlMs - Time to live in milliseconds.
	 */
	static set<T = unknown>(key: string, value: T, ttlMs: number): void {
		const expires = Date.now() + ttlMs;
		localStorage.setItem(key, JSON.stringify({ value, expires }));
	}

	/**
	 * Gets a value from cache if not expired.
	 * @param key - Storage key.
	 * @returns The cached value or null if missing/expired.
	 */
	static get<T = unknown>(key: string): T | null {
		const raw = localStorage.getItem(key);
		if (!raw) return null;

		try {
			const { value, expires } = JSON.parse(raw) as { value: T; expires: number };
			if (Date.now() > expires) {
				localStorage.removeItem(key);
				return null;
			}
			return value;
		} catch {
			localStorage.removeItem(key);
			return null;
		}
	}

	/**
	 * Removes a value from cache.
	 * @param key - Storage key.
	 */
	static remove(key: string): void {
		localStorage.removeItem(key);
	}
}
