import { ShopifyClient } from './shopify-client';
import { logger } from '@/utils/error';
import { Cache } from '@/utils/cache';
import { Store } from '@/types';

export default async function fetchStoreDetails(
	shopifyClient: ShopifyClient,
	cacheKey: string,
	cacheTTL: number,
): Promise<Store> {
	const cached = Cache.get<Store>(cacheKey);
	if (cached && cached.shopName && cached.moneyFormat) {
		return cached;
	}

	logger.warn('Invalid cached shop info, fetching fresh.');

	const query = `
	{
			shop {
					name
					moneyFormat
			}
	}
	`;
	const res = await shopifyClient.executeQuery(query);
	if (!res?.data?.shop) {
		throw logger.error('Failed to fetch shop details from Shopify');
	}

	const store = {
		shopName: res.data.shop.name,
		moneyFormat: res.data.shop.moneyFormat,
	};
	Cache.set(cacheKey, store, cacheTTL);

	return store;
}
