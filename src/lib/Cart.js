import { Cache, MoneyFormatter } from "./utils.js";

export class Cart {
    constructor(shopifyClient, productManager, storageKey = "blink_cart") {
        this.shopifyClient = shopifyClient;
        this.productManager = productManager;
        this._cartStorageKey = storageKey;
        this._cart = null;
        this.cartId = null;
        this._templates = {};
        this._moneyFormat = "{{amount}}{{currency_code}}";
        this._cartCacheTTL = 1000 * 60 * 10 * 24; // 1 DAY
        this.onCartChange = null; // callback for UI updates
    }

    async init() {
        await this._fetchShopMoneyFormat();
        try {
            const cachedCart = Cache.get(this._cartStorageKey);
            if (cachedCart) {
                this._cart = cachedCart;
                this.cartId = this._cart.id;
                console.info(
                    "[Blink] Cart loaded from localStorage:",
                    this._cart
                );
            }
        } catch (err) {
            console.warn("[Blink] Invalid or expired cart, resetting...");
            await this.clearCart();
        }
    }

    async _fetchShopMoneyFormat() {
        // Try to load from localStorage first
        const cached = Cache.get("blink_shop_info");
        if (cached) {
            try {
                const info = cached;
                this._moneyFormat =
                    info.moneyFormat || "{{amount}}{{currency_code}}";
                // Optionally, you could also set shopName here if needed
                return;
            } catch (e) {
                // Ignore and fetch fresh
            }
        }
        const query = `
        {
            shop {
                name
                moneyFormat
            }
        }
        `;
        const res = await this.shopifyClient.executeQuery(query);
        this._moneyFormat =
            res?.data?.shop?.moneyFormat || "{{amount}}{{currency_code}}";
        // Cache shop info for later use
        if (res?.data?.shop) {
            Cache.set(
                "blink_shop_info",
                {
                    shopName: res.data.shop.name,
                    moneyFormat: res.data.shop.moneyFormat,
                },
                1000 * 60 * 60 // 1 hour TTL for shop info
            );
        }
    }

    async addToCart({ variantId, quantity = 1 }) {
        if (!this._cart) {
            const cart = await this._createCart(variantId, quantity);
            this.cartId = cart.id;
            await this.refreshCart();
            return this._cart;
        } else {
            await this._addToExistingCart(variantId, quantity);
            await this.refreshCart();
            return this._cart;
        }
    }

    async _createCart(variantId, quantity) {
        const query = `
            mutation cartCreate($input: CartInput!) {
                cartCreate(input: $input) {
                 cart {
                    id
                }
                userErrors {
                    field
                    message
                }
                }
            }
            `;
        const variables = {
            input: {
                lines: [
                    {
                        quantity,
                        merchandiseId: variantId,
                    },
                ],
            },
        };
        const response = await this.shopifyClient.executeQuery(
            query,
            variables
        );
        if (response.userErrors && response.userErrors.length > 0) {
            console.error("[Blink] Shopify user errors:", response.userErrors);
            throw new Error(
                "Failed to create cart: " + response.userErrors[0].message
            );
        }
        return response.data.cartCreate.cart;
    }

    async _addToExistingCart(variantId, quantity) {
        const query = `
            mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
                cartLinesAdd(cartId: $cartId, lines: $lines) {
                cart {
                    id
                }
                userErrors {
                    field
                    message
                }
                }
            }
            `;
        const variables = {
            cartId: this.cartId,
            lines: [{ quantity, merchandiseId: variantId }],
        };
        const res = await this.shopifyClient.executeQuery(query, variables);
        if (
            res.data.cartLinesAdd.userErrors &&
            res.data.cartLinesAdd.userErrors.length > 0
        ) {
            console.error(
                "[Blink] Shopify user errors:",
                res.data.cartLinesAdd.userErrors
            );
            throw new Error(
                "Failed to add to cart: " +
                    res.data.cartLinesAdd.userErrors[0].message
            );
        }
        return res.data.cartLinesAdd.cart;
    }

    async fetchCart(cartId) {
        const query = `
            query getCart($cartId: ID!) {
            cart(id: $cartId) {
                id
                checkoutUrl
                createdAt
                updatedAt
                totalQuantity

                lines(first: 50) {
                edges {
                    node {
                    id
                    quantity
                    attributes {
                        key
                        value
                    }
                    cost {
                        amountPerQuantity {
                        amount
                        currencyCode
                        }
                        totalAmount {
                        amount
                        currencyCode
                        }
                    }
                    merchandise {
                        ... on ProductVariant {
                        id
                        title
                        sku
                        availableForSale
                        quantityAvailable
                        image {
                            url
                            altText
                        }
                        price {
                            amount
                            currencyCode
                        }
                        product {
                            id
                            title
                            handle
                            vendor
                            featuredImage {
                            url
                            altText
                            }
                        }
                        }
                    }
                    sellingPlanAllocation {
                        sellingPlan {
                        id
                        name
                        options {
                            name
                            value
                        }
                        }
                    }
                    }
                }
                }

                estimatedCost {
                subtotalAmount {
                    amount
                    currencyCode
                }
                totalAmount {
                    amount
                    currencyCode
                }
                totalTaxAmount {
                    amount
                    currencyCode
                }
                }
            }
            }
        `;

        const variables = { cartId };
        const res = await this.shopifyClient.executeQuery(query, variables);
        if (res.errors) {
            console.error("[Blink] Error fetching cart:", res.errors);
            return null;
        }
        return res.data.cart;
    }

    async clearCart() {
        if (
            this._cart &&
            this._cart.lines &&
            this._cart.lines.edges.length > 0
        ) {
            const lineIds = this._cart.lines.edges.map((edge) => edge.node.id);
            if (lineIds.length > 0) {
                const query = `
                mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
                    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
                        cart { id }
                        userErrors { field message }
                    }
                }
            `;
                const variables = { cartId: this.cartId, lineIds };
                await this.shopifyClient.executeQuery(query, variables);
            }
            await this.refreshCart();
        } else {
            await this.refreshCart();
        }
    }

    async removeLineItem(lineId) {
        const query = `
        mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
            cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
                cart { id }
                userErrors { field message }
            }
        }
    `;
        const variables = { cartId: this.cartId, lineIds: [lineId] };
        await this.shopifyClient.executeQuery(query, variables);
    }

    async refreshCart() {
        this._cart = await this.fetchCart(this.cartId);
        Cache.set(this._cartStorageKey, this._cart, this._cartCacheTTL);
        this.cartId = this._cart.id;
        console.info("[Blink] Cart refreshed:", this._cart);
        if (typeof this.onCartChange === "function") {
            this.onCartChange(this._cart);
        }
    }
}