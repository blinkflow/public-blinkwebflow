import { logger } from './error';

export type ShopifyClient = {
	executeQuery: (query: string, variables?: Record<string, any>) => Promise<any>;
};

export function createShopifyClient({ token, storeDomain }: { token: string; storeDomain: string }): ShopifyClient {
	async function executeQuery(query: string, variables: Record<string, any> = {}) {
		if (!token || !storeDomain) {
			throw logger.error('Shopify instance is not initialized.');
		}

		const url = `https://${storeDomain}/api/2025-04/graphql.json`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Shopify-Storefront-Access-Token': token,
			},
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => null);
			throw logger.error('Shopify API Error:', errorData || response.statusText);
		}

		return response.json();
	}

	return { executeQuery };
}
