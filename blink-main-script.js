class GlobalBlink {
    constructor(config = {}) {
        this.shopify = null;
        this._cartStorageKey = "blink_cart";
        this._cart = null;
        this._init(config);
    }

    async _init(config) {
        this._initShopify(config);
        if (!this.shopify) {
            console.error("[Blink] Shopify instance not initialized.");
            return;
        }
        try {
            const cachedCart = localStorage.getItem(this._cartStorageKey);
            if (cachedCart) {
                this._cart = JSON.parse(cachedCart);
                this.cartId = this._cart.id;
                console.info(
                    "[Blink] Cart loaded from localStorage:",
                    this._cart
                );
            }
        } catch (err) {
            console.warn("[Blink] Invalid or expired cart, resetting...");
            this._clearCart();
        }

        this._setupAddToCartButtons();
    }

    _initShopify(config) {
        if (config.shopify) {
            this.shopify = config.shopify;
            console.info("[Blink] Shopify instance provided:", this.shopify);
            return;
        }

        const tokenFromDOM = this._getTokenFromDOM();
        const storeDomainFromDOM = this._getStoreDomainFromDOM();

        if (!tokenFromDOM) {
            console.error(
                "[Blink] Shopify Token not provided or found in DOM."
            );
            return;
        }
        if (!storeDomainFromDOM) {
            console.error("[Blink] Store Domain not provided or found in DOM.");
            return;
        }

        this.shopify = {
            token: tokenFromDOM,
            storeDomain: storeDomainFromDOM,
        };

        console.info("[Blink] Shopify instance created:", this.shopify);
    }
    /**
     * Execute a GraphQL query against the Shopify Storefront API
     * @param {string} query - GraphQL query string
     * @param {Object} variables - Variables for the query
     * @returns {Promise<Object>} Query result
     */

    async _executeShopifyQuery(query, variables = {}) {
        if (!this.shopify || !this.shopify.token || !this.shopify.storeDomain) {
            console.error("[Blink] Shopify instance is not initialized.");
            return;
        }

        const url = `https://${this.shopify.storeDomain}/api/2024-01/graphql.json`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Storefront-Access-Token": this.shopify.token,
                },
                body: JSON.stringify({ query, variables }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Shopify API Error:", errorData);
                throw new Error(`Shopify GraphQL error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Shopify API Error:", error.message);
            throw error;
        }
    }

    _getTokenFromDOM() {
        const el = document.querySelector(
            'script[data-name="blink-main-script"]'
        );
        return el?.getAttribute("data-store-token") ?? null;
    }

    _getStoreDomainFromDOM() {
        const el = document.querySelector(
            'script[data-name="blink-main-script"]'
        );
        return el?.getAttribute("data-store-domain") ?? null;
    }

    _setupAddToCartButtons() {
        const buttons = document.querySelectorAll("[data-bf-add-to-cart]");
        buttons.forEach((button) => {
            button.addEventListener("click", () =>
                this._handleAddToCart(button)
            );
        });
    }

    _handleAddToCart(button) {
        const productEl = button.closest("[data-bf-product-id]");
        const variantId = button.getAttribute("data-bf-variant-id");
        const quantityEl = productEl?.querySelector("[data-bf-qty]");

        const quantity = quantityEl ? parseInt(quantityEl.value, 10) : 1;

        if (!variantId) {
            console.error("[Blink] Missing data-bf-variant-id.");
            return;
        }

        this.addToCart({ variantId, quantity })
            .then(() => {
                console.log("[Blink] Added to cart:", { variantId, quantity });
            })
            .catch((err) => {
                console.error("[Blink] Add to cart failed:", err);
            });
    }

    async addToCart({ variantId, quantity = 1 }) {
        if (!this._cart) {
            const cart = await this._createCart(variantId, quantity);
            this.cartId = cart.id;
            this._cart = await this._fetchCart(this.cartId);
            localStorage.setItem(
                this._cartStorageKey,
                JSON.stringify(this._cart)
            );
            return this._cart;
        } else {
            await this._addToExistingCart(variantId, quantity);
            this._cart = await this._fetchCart(this.cartId); // update with fresh data
            localStorage.setItem(
                this._cartStorageKey,
                JSON.stringify(this._cart)
            );
            return this._cart;
        }
    }

    async _createCart(variantId, quantity) {
        try {
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

            const response = await this._executeShopifyQuery(query, variables);
            if (response.userErrors && response.userErrors.length > 0) {
                console.error(
                    "[Blink] Shopify user errors:",
                    response.userErrors
                );
                throw new Error(
                    "Failed to create cart: " + response.userErrors[0].message
                );
            }
            return response.data.cartCreate.cart
        } catch (error) {
            console.error("[Blink] Error creating cart:", error);
        }
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
        const res = await this._executeShopifyQuery(query, variables);
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
        return res.data.cartLinesAdd.cart
    }

    async _fetchCart(cartId) {
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
        const res = await this._executeShopifyQuery(query, variables);
        if (res.errors) {
            console.error("[Blink] Error fetching cart:", res.errors);
            throw new Error("Failed to fetch cart: " + res.errors[0].message);
        }
        return res.data.cart;
    }

    _clearCart() {
        localStorage.removeItem(this._cartStorageKey);
        this.cartId = null;
        this._cart = null;
    }

    get token() {
        return this._storeToken;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    window.Blink = new GlobalBlink();
});
