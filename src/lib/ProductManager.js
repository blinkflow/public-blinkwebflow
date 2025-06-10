import { Cache } from "./utils.js";

/**
 * Manages product data fetching and caching.
 */
export class ProductManager {
    /**
     * @param {object} shopifyClient - Shopify client instance.
     */
    constructor(shopifyClient) {
        this.shopifyClient = shopifyClient;
        this.currentProducts = {};
        this._productCacheKey = "blink_products";
        this._productCacheTTL = 1000 * 60 * 10; // 10 minutes
    }

    /**
     * Fetches all products on the page or by given IDs.
     * @param {string[]|null} [productIds=null] - Optional array of product IDs.
     * @returns {Promise<void>}
     */
    async fetchAllProductsOnPage(productIds = null) {
        // Accepts optional productIds for UI to control which products to fetch
        const ids =
            productIds ||
            Array.from(document.querySelectorAll("[data-bf-product-id]"))
                .map((el) => el.getAttribute("data-bf-product-id"))
                .filter(Boolean);
        const uniqueIds = [...new Set(ids)];

        // Try to load from cache
        const cached = Cache.get(this._productCacheKey) || {};
        const idsToFetch = uniqueIds.filter((id) => !cached[id]);
        // Use cached products
        for (const id of uniqueIds) {
            if (cached[id]) {
                this.currentProducts[id] = cached[id];
            }
        }
        // Fetch missing/expired products
        await Promise.all(
            idsToFetch.map(async (id) => {
                try {
                    const product = await this.fetchAndStoreProduct(id);
                    if (product) {
                        this.currentProducts[id] = product;
                    }
                } catch (err) {
                    console.error(
                        `[Blink] Failed to fetch product ${id}:`,
                        err
                    );
                }
            })
        );

        Cache.set(
            this._productCacheKey,
            { ...cached, ...this.currentProducts },
            this._productCacheTTL
        );
    }

    /**
     * Fetches a product by ID from Shopify and stores it.
     * @param {string} productId
     * @returns {Promise<object|null>} The product object or null.
     */
    async fetchAndStoreProduct(productId) {
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
                    metafields(identifiers: []) {
                      id
                      namespace
                      key
                      value
                      reference {
                        __typename
                        ... on MediaImage {
                          alt
                          image { url }
                        }
                      }
                      type
                      description
                    }
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
                    metafields(identifiers: []) {
                      id
                      namespace
                      key
                      value
                      reference {
                        __typename
                        ... on MediaImage {
                          alt
                          image { url }
                        }
                      }
                      type
                      description
                    }
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
        const res = await this.shopifyClient.executeQuery(query, {
            id: productId,
        });
        if (res && res.data && res.data.node) {
            return res.data.node;
        }
        return null;
    }
}