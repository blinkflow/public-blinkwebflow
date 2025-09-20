import { ShopifyClient } from '@/utils/shopify-client';
import { mapProductIdToGid } from '@/utils/id-mapper';
import { ShopifyProduct } from '@/types/products';
import { publishEvent } from '@/utils/events';
import { logger } from '@/utils/error';
import { Cache } from '@/utils/cache';

export default class ProductManager {
	public currentProducts: Map<string, ShopifyProduct>;

	constructor(
		private shopifyClient: ShopifyClient,
		private cacheKey: string,
		private cacheTTL: number,
	) {
		this.currentProducts = new Map();
	}

	async fetchProducts(productIds?: string[]) {
		const ids =
			productIds ??
			Array.from(document.querySelectorAll('[data-bf-product-id]'))
				.map((el) => el.getAttribute('data-bf-product-id') as string)
				.filter(Boolean);

		const uniqueIds = [...new Set(ids)];
		const cached = new Map(Cache.get<[string, ShopifyProduct][]>(this.cacheKey));
		const idsToFetch = uniqueIds.filter((id) => !cached.has(id));

		uniqueIds.forEach((id) => {
			if (cached.has(id)) {
				this.currentProducts.set(id, cached.get(id)!);
			}
		});

		// Fetch missing
		await Promise.all(
			idsToFetch.map(async (id) => {
				try {
					const gid = mapProductIdToGid(id);
					const product = await this.fetchProduct(gid);
					if (product) {
						this.currentProducts.set(id, product);
					}
				} catch (err) {
					logger.error(`Failed to fetch product ${id}:`, err);
				}
			}),
		);
		Cache.set(this.cacheKey, Array.from(this.currentProducts.entries()), this.cacheTTL);
		publishEvent('products:fetched');
	}

	async fetchProduct(productId: string) {
		const query = `
        query Products($id: ID!) @inContext(language: EN) {
          node(id: $id) {
            ... on Product {
              id
              title
              handle
              description
              descriptionHtml
              priceRange {
                minVariantPrice { amount currencyCode }
                maxVariantPrice { amount currencyCode }
              }
              compareAtPriceRange {
                minVariantPrice { amount currencyCode }
                maxVariantPrice { amount currencyCode }
              }
              options {
                name
                optionValues {
                  id
                  name
                  swatch {
                    color
                    image {
                      id
                      alt
                      previewImage {
                        altText
                        url
                      }
                    }
                  }
                }
              }
              images(first: 100) {
                edges {
                  node {
                    src
                    altText
                    id
                    width
                    height
                  }
                }
              }
              collections(first: 250) {
                edges {
                  node {
                    id
                    title
                    handle
                    description
                    descriptionHtml
                    image { src }
                  }
                }
              }
              vendor
              productType
              tags
              requiresSellingPlan
              variants(first: 100) {
                edges {
                  node {
                    id
                    product { id title vendor }
                    title
                    sku
                    barcode
                    price { amount currencyCode }
                    unitPrice { amount currencyCode }
                    compareAtPrice { amount currencyCode }
                    image { src altText id width height }
                    selectedOptions { name value }
                    availableForSale
                    currentlyNotInStock
                    quantityAvailable
                    product { id title vendor }
                    weight
                    weightUnit
                    sellingPlanAllocations(first: 10) {
                      edges {
                        node {
                          sellingPlan {
                            id
                            name
                            description
                            checkoutCharge { type value }
                            recurringDeliveries
                            options { name value }
                          }
                          priceAdjustments {
                            price { amount currencyCode }
                            compareAtPrice { amount currencyCode }
                            perDeliveryPrice { amount currencyCode }
                            unitPrice { amount currencyCode }
                          }
                        }
                      }
                    }
                  }
                }
              }
              sellingPlanGroups(first: 10) {
                edges {
                  node {
                    appName
                    name
                    sellingPlans(first: 10) {
                      edges {
                        node {
                          id
                          name
                          description
                          recurringDeliveries
                          options { name value }
                          priceAdjustments {
                            orderCount
                            adjustmentValue {
                              __typename
                              ... on SellingPlanPercentagePriceAdjustment {
                                adjustmentPercentage
                              }
                              ... on SellingPlanFixedAmountPriceAdjustment {
                                adjustmentAmount { amount currencyCode }
                              }
                              ... on SellingPlanFixedPriceAdjustment {
                                price { amount currencyCode }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        `;
		const res = await this.shopifyClient.executeQuery(query, { id: productId });
		return res?.data?.node ?? null;
	}
}
