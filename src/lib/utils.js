/**
 * Simple localStorage-based cache with TTL.
 */
export class Cache {
    /**
     * Sets a value in cache with TTL.
     * @param {string} key
     * @param {*} value
     * @param {number} ttlMs - Time to live in milliseconds.
     */
    static set(key, value, ttlMs) {
        const expires = Date.now() + ttlMs;
        localStorage.setItem(key, JSON.stringify({ value, expires }));
    }
    /**
     * Gets a value from cache if not expired.
     * @param {string} key
     * @returns {*|null}
     */
    static get(key) {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        try {
            const { value, expires } = JSON.parse(raw);
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
     * @param {string} key
     */
    static remove(key) {
        localStorage.removeItem(key);
    }
}

/**
 * Formats money values according to a format string.
 */
export class MoneyFormatter {
    /**
     * Formats an amount as a string.
     * @param {number|string} amount
     * @param {string} currency
     * @param {string} [moneyFormat="{{amount}}{{currency_code}}"]
     * @returns {string}
     */
    static format(
        amount,
        currency,
        moneyFormat = "{{amount}}{{currency_code}}"
    ) {
        let formatted = moneyFormat || "${{amount}}";
        formatted = formatted.replace("{{amount}}", parseFloat(amount).toFixed(2));
        formatted = formatted.replace("{{currency_code}}", currency || "");
        return formatted;
    }
}
