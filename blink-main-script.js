class GlobalBlink {
    constructor(config = {}) {
        this.shopify = null;
        this._cartStorageKey = "blink_cart";
        this._cart = null;
        this.currentProducts = {};
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
        await this._fetchAllProductsOnPage();
        this._setupCartTriggerButtons();
        this._setupCheckoutButtons();
        this._setupClearCartButtons();
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
     * Fetches product data for all products on the page and stores in currentProducts.
     */
    async _fetchAllProductsOnPage() {
        const productEls = document.querySelectorAll("[data-bf-product-id]");
        const ids = Array.from(productEls)
            .map((el) => el.getAttribute("data-bf-product-id"))
            .filter(Boolean);

        // Avoid duplicate fetches
        const uniqueIds = [...new Set(ids)];

        await Promise.all(
            uniqueIds.map(async (id) => {
                try {
                    const product = await this._fetchAndStoreProduct(id);
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
    }

    /**
     * Fetches a single product by Shopify node ID and returns the product object.
     * @param {string} productId
     * @returns {Promise<Object|null>}
     */
    async _fetchAndStoreProduct(productId) {
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
        const res = await this._executeShopifyQuery(query, { id: productId });
        if (res && res.data && res.data.node) {
            return res.data.node;
        }
        return null;
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

        const url = `https://${this.shopify.storeDomain}/api/2025-04/graphql.json`;

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
        const quantityEl = productEl?.querySelector("[data-bf-qty]");

        const quantity = quantityEl ? parseInt(quantityEl.value, 10) : 1;

        const product = this.currentProducts[productEl.dataset.bfProductId];
        if (!product) {
            console.error(
                "[Blink] Product not found in currentProducts:",
                productEl.dataset.bfProductId
            );
            return;
        }

        const variantId = product?.variants?.edges?.[0]?.node?.id;

        if (!variantId) {
            console.error("[Blink] Missing variant id.");
            return;
        }
        this._setButtonLoading(button, true);
        this.addToCart({ variantId, quantity })
            .then(() => {
                console.log("[Blink] Added to cart:", { variantId, quantity });
                this._openCartDrawer();
            })
            .catch((err) => {
                console.error("[Blink] Add to cart failed:", err);
            })
            .finally(() => {
                this._setButtonLoading(button, false);
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

    /**
     * Setup cart trigger buttons to toggle the cart drawer.
     */
    _setupCartTriggerButtons() {
        const triggers = document.querySelectorAll("[data-bf-cart-trigger]");
        triggers.forEach((button) => {
            button.addEventListener("click", () => {
                this._toggleCartDrawer();
            });
        }); 
    }

    /**
     * Toggles the cart drawer open/closed.
     */
    _toggleCartDrawer() {
        const cartDrawer = document.querySelector("[data-bf-cart-drawer]");
        if (cartDrawer) {
            const isOpen = cartDrawer.classList.contains("open");
            if (isOpen) {
                cartDrawer.classList.remove("open");
                cartDrawer.setAttribute("aria-hidden", "true");
            } else {
                cartDrawer.classList.add("open");
                cartDrawer.setAttribute("aria-hidden", "false");
            }
        }
    }

    /**
     * Opens the cart drawer by adding an "open" class and setting aria-hidden.
     */
    _openCartDrawer() {
        const cartDrawer = document.querySelector("[data-bf-cart-drawer]");
        if (cartDrawer) {
            cartDrawer.classList.add("open");
            cartDrawer.setAttribute("aria-hidden", "false");
        }
    }

    /**
     * Sets loading state on the given button.
     * @param {HTMLElement} button
     * @param {boolean} isLoading
     */
    _setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.classList.add("bf-loading");
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = "Adding...";
        } else {
            button.disabled = false;
            button.classList.remove("bf-loading");
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
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
        return res.data.cartLinesAdd.cart;
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

    /**
     * Setup clear cart buttons to clear the cart and update UI.
     */
    _setupClearCartButtons() {
        const clearButtons = document.querySelectorAll("[data-bf-clear-cart]");
        clearButtons.forEach((button) => {
            button.addEventListener("click", (e) => {
                e.preventDefault();
                this._clearCart();
            });
        });
    }

    /**
     * Setup checkout buttons to use the current cart's checkoutUrl.
     */
    _setupCheckoutButtons() {
        const checkoutButtons = document.querySelectorAll("[data-bf-checkout]");
        checkoutButtons.forEach((button) => {
            button.addEventListener("click", (e) => {
                e.preventDefault();
                if (this._cart && this._cart.checkoutUrl) {
                    // You can redirect or use the URL as needed
                    window.location.href = this._cart.checkoutUrl;
                } else {
                    console.warn("[Blink] No checkoutUrl available on cart.");
                }
            });
        });
    }

    get token() {
        return this._storeToken;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    window.Blink = new GlobalBlink();
});
