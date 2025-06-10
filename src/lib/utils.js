export class Cache {
    static set(key, value, ttlMs) {
        const expires = Date.now() + ttlMs;
        localStorage.setItem(key, JSON.stringify({ value, expires }));
    }
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
    static remove(key) {
        localStorage.removeItem(key);
    }
}

export class MoneyFormatter {
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
