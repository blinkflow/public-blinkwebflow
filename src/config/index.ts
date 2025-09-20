import { logger } from '@/utils/error';

export type Config = {
	shopify: {
		token: string;
		storeDomain: string;
	};
	cache: {
		ttl: {
			default: number;
			products: number;
			store: number;
			cart: number;
		};
		keys: {
			products: string;
			store: string;
			cart: string;
		};
		[key: string]: unknown;
	};
};

export function createConfig(): Config {
	const scriptEl = document.querySelector('script[data-name="blink-main-script"]');

	if (!scriptEl) {
		throw logger.error('Script not found');
	}

	const token = scriptEl.getAttribute('data-store-token');
	const storeDomain = scriptEl.getAttribute('data-store-domain');

	if (!token || !storeDomain) {
		throw logger.error('Shopify Token or Store Domain not provided');
	}

	const config: Config = {
		shopify: {
			token,
			storeDomain,
		},
		cache: {
			ttl: {
				default: 1000 * 60 * 10,
				products: 1000 * 60 * 10,
				store: 1000 * 60 * 60,
				cart: 1000 * 60 * 60 * 24,
			},
			keys: {
				products: 'blink_products',
				store: 'blink_store',
				cart: 'blink_cart',
			},
		},
	};

	return config;
}
