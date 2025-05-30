class Blink {
    constructor(config = {}) {
        this.shopify = null;
        this._cartIdStorageKey = "blink_cart_id";
        this._init(config);
        this.cartId = this._loadCartIdFromStorage();
        this._cart = null;
    }

    async _init(config) {
        this._initShopify(config);

        if (this.cartId) {
            try {
                const cart = await this._fetchCart(this.cartId);
                this._cart = cart;
            } catch (err) {
                console.warn("[Blink] Invalid or expired cart, resetting...");
                this._clearCart();
            }
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
        if (!this.cartId) {
            const cart = await this._createCart(variantId, quantity);
            this.cartId = cart.id;
            this._saveCartIdToStorage(cart.id);
            this._cart = await this._fetchCart(this.cartId);
            return this._cart;
        } else {
            await this._addToExistingCart(variantId, quantity);
            this._cart = await this._fetchCart(this.cartId); // update with fresh data
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
            checkoutUrl
            lines(first: 5) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                    }
                  }
                }
              }
            }
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
            return response.data.cartCreate.cart;
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
            lines(first: 10) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                    }
                  }
                }
              }
            }
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
        return res.data.cartLinesAdd.cart;
    }

    async _fetchCart(cartId) {
        const query = `
      query getCart($cartId: ID!) {
        cart(id: $cartId) {
          id
          checkoutUrl
          lines(first: 10) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                  }
                }
              }
            }
          }
        }
      }
    `;
        const variables = { cartId };
        const res = await this._executeShopifyQuery(query, variables);
        return res.data.cart;
    }

    _clearCart() {
        localStorage.removeItem(this._cartIdStorageKey);
        this.cartId = null;
        this._cart = null;
    }

    _loadCartIdFromStorage() {
        return localStorage.getItem(this._cartIdStorageKey);
    }

    _saveCartIdToStorage(cartId) {
        localStorage.setItem(this._cartIdStorageKey, cartId);
    }

    get token() {
        return this._storeToken;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    window.Blink = new Blink();
});
