class GlobalBlink {
    constructor(config = {}) {
        this.shopify = null;
        this._cartStorageKey = "blink_cart";
        this._cart = null;
        this.currentProducts = {};
        this._init(config);
        this._templates = {};
    }

    _loaderSVG = `
        <svg class="bf-loader-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.2"/>
        <path d="M22 12a10 10 0 0 1-10 10" />
        <style>
            .bf-loader-svg { animation: bf-rotate 1s linear infinite; vertical-align: middle;}
            @keyframes bf-rotate { 100% { transform: rotate(360deg); } }
        </style>
        </svg>
        `;

    _checkSVG = `
        <svg class="bf-check-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"/>
        </svg>
        `;

    async _init(config) {
        this._closeCartDrawer();
        this._initShopify(config);
        if (!this.shopify) {
            console.error("[Blink] Shopify instance not initialized.");
            return;
        }
        await this._fetchShopMoneyFormat();
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
            await this._clearCart();
        }

        await this._fetchAllProductsOnPage();
        this._setupAddToCartButtons();
        this._renderProductPrices();
        this._setupCartTriggerButtons();
        this._renderCart();
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
     * Renders product price and compare at price for the first variant in each product container.
     */
    _renderProductPrices() {
        document
            .querySelectorAll("[data-bf-product-id]")
            .forEach((productEl) => {
                const productId = productEl.getAttribute("data-bf-product-id");
                const product = this.currentProducts[productId];
                if (!product) return;

                // Get first variant
                const variant = product.variants?.edges?.[0]?.node;
                if (!variant) return;

                // Render price
                const priceEl = productEl.querySelector(
                    "[data-bf-product-price]"
                );
                if (priceEl && variant.price) {
                    priceEl.textContent = this._formatMoney(
                        variant.price.amount,
                        variant.price.currencyCode
                    );
                }

                // Render compare at price
                const compareAtEl = productEl.querySelector(
                    "[data-bf-product-compare-at-price]"
                );
                if (
                    compareAtEl &&
                    variant.compareAtPrice &&
                    variant.compareAtPrice.amount
                ) {
                    compareAtEl.textContent = this._formatMoney(
                        variant.compareAtPrice.amount,
                        variant.compareAtPrice.currencyCode
                    );
                    compareAtEl.style.display = "";
                } else if (compareAtEl) {
                    compareAtEl.style.display = "none";
                }
            });
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
            // Check if first variant is available before setting up click
            const productEl = button.closest("[data-bf-product-id]");
            if (productEl) {
                const productId = productEl.getAttribute("data-bf-product-id");
                const product = this.currentProducts[productId];
                const variant = product?.variants?.edges?.[0]?.node;
                if (!variant || !variant.availableForSale) {
                    button.disabled = true;
                    button.innerHTML = "Out of stock";
                }
            }

            button.addEventListener("click", (e) => {
                e.preventDefault();
                this._handleAddToCart(button);
            });
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

        const variant = product?.variants?.edges?.[0]?.node;
        const variantId = variant?.id;

        // Check if first variant is available for sale
        if (!variant || !variant.availableForSale) {
            button.disabled = true;
            button.innerHTML = "Out of stock";
            return;
        }

        if (!variantId) {
            console.error("[Blink] Missing variant id.");
            return;
        }

        this._setButtonLoading(button, true);
        this.addToCart({ variantId, quantity })
            .then(() => {
                console.log("[Blink] Added to cart:", { variantId, quantity });
                button.innerHTML = this._checkSVG;
                setTimeout(() => {
                    this._setButtonLoading(button, false);
                }, 1500);
                this._openCartDrawer();
            })
            .catch((err) => {
                button.innerHTML = "Error";
                setTimeout(() => {
                    this._setButtonLoading(button, false);
                }, 1500);
                console.error("[Blink] Add to cart failed:", err);
            });
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
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.innerHTML;
            }
            button.innerHTML = this._loaderSVG;
        } else {
            button.disabled = false;
            button.classList.remove("bf-loading");
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    _setButtonSuccess(button) {
        button.disabled = true;
        button.innerHTML = this._checkSVG;
        setTimeout(() => {
            this._setButtonLoading(button, false);
        }, 1500);
    }

    /**
     * Adds a product variant to the cart, creating a new cart if necessary.
     * @param {Object} params - Parameters for adding to cart.
     * @param {string} params.variantId - The ID of the product variant to add.
     * @param {number} [params.quantity=1] - The quantity of the variant to add.
     * @returns {Promise<Object>} The updated cart object.
     */
    async addToCart({ variantId, quantity = 1 }) {
        if (!this._cart) {
            const cart = await this._createCart(variantId, quantity);
            this.cartId = cart.id;
            await this._refreshCart();
            return this._cart;
        } else {
            await this._addToExistingCart(variantId, quantity);
            await this._refreshCart();
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
                const cartDrawer = document.querySelector(
                    "[data-bf-cart-drawer]"
                );
                if (cartDrawer) {
                    const isOpen = cartDrawer.classList.contains("open");
                    if (isOpen) {
                        this._closeCartDrawer(cartDrawer);
                    } else {
                        this._openCartDrawer(cartDrawer);
                    }
                }
            });
        });
    }

    /**
     * Toggles the cart drawer open/closed.
     * @param {HTMLElement} cartDrawer - The cart drawer element to toggle.
     * If not provided, it will look for the first element with [data-bf-cart-drawer].
     */
    _closeCartDrawer(cartDrawer) {
        const drawer = cartDrawer
            ? cartDrawer
            : document.querySelector("[data-bf-cart-drawer]");
        if (drawer) {
            drawer.classList.remove("open");
            drawer.setAttribute("aria-hidden", "true");
        }
    }

    /**
     * Opens the cart drawer by adding an "open" class and setting aria-hidden.
     * @param {HTMLElement} cartDrawer - The cart drawer element to open.
     * If not provided, it will look for the first element with [data-bf-cart-drawer].
     */
    _openCartDrawer(cartDrawer) {
        const drawer = cartDrawer
            ? cartDrawer
            : document.querySelector("[data-bf-cart-drawer]");

        if (drawer) {
            drawer.classList.add("open");
            drawer.setAttribute("aria-hidden", "false");
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

    /**
     * Adds a line item to an existing cart.
     * @param {string} variantId - The ID of the product variant to add.
     * @param {number} quantity - The quantity of the variant to add.
     * @returns {Promise<Object>} The updated cart object.
     */
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

    /**
     * Fetches the cart by ID and returns the cart object.
     * @param {string} cartId - The ID of the cart to fetch.
     * @returns {Promise<Object>} The cart object.
     */
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
            return null;
        }
        return res.data.cart;
    }

    async _clearCart() {
        if (
            this._cart &&
            this._cart.lines &&
            this._cart.lines.edges.length > 0
        ) {
            // Remove all line items from the cart
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
                await this._executeShopifyQuery(query, variables);
            }
            // Refresh cart after removing all items
            await this._refreshCart();
        } else {
            // If no cart or already empty, just refresh
            await this._refreshCart();
        }
    }

    /**
     * Setup clear cart buttons to clear the cart and update UI.
     */
    _setupClearCartButtons() {
        const clearButtons = document.querySelectorAll("[data-bf-clear-cart]");
        clearButtons.forEach((button) => {
            button.addEventListener("click", async (e) => {
                e.preventDefault();
                await this._clearCart();
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

    /**
     * Renders the cart line items and updates subtotal/total in the DOM.
     */
    _renderCart() {
        // Update all line item containers
        document.querySelectorAll("[data-bf-cart]").forEach((cart) => {
            // Get Cart Line Item Container
            const container = cart.querySelector("[data-bf-line-items]");
            if (!container) {
                console.warn("[Blink] No cart line item container found.");
                return;
            }

            let template = this._templates.cartTemplate;
            // Get and store the template line item element
            if (!template) {
                template = container.querySelector("[data-bf-line-item]");
                if (!template) {
                    console.warn("[Blink] No cart line item template found.");
                    return;
                }
                this._templates.cartTemplate = template.cloneNode(true);
            }

            template.style.display = "none"; // Hide the template in the DOM

            const emptyMessage = cart.querySelector(
                "[data-bf-empty-cart-message]"
            );

            if (emptyMessage) {
                emptyMessage.style.display = "none";
            }

            // Remove all existing line items except the template
            container.querySelectorAll("[data-bf-line-item]").forEach((el) => {
                if (el !== template) el.remove();
            });

            const subTotalElem = cart.querySelector("[data-bf-cart-subtotal]");
            const totalElem = cart.querySelector("[data-bf-cart-total]");
            this._updateCartTotals(subTotalElem, totalElem);

            // If no cart or no lines, hide all but template and clear totals
            if (
                !this._cart ||
                !this._cart.lines ||
                !this._cart.lines.edges.length
            ) {
                template.style.display = "none";
                emptyMessage.style.display = "";
                return;
            }

            // Render each line item
            this._cart.lines.edges.forEach((edge, i) => {
                const line = edge.node;
                const itemEl = template.cloneNode(true);
                container.appendChild(itemEl);
                itemEl.style.display = "";

                // Set image
                const img = itemEl.querySelector("[data-bf-line-image]");
                if (img) {
                    img.src = line.merchandise.image?.url;
                    img.alt = line.merchandise.image?.altText || "";
                }

                // Set title
                const titleEl = itemEl.querySelector("[data-bf-line-title]");
                if (titleEl)
                    titleEl.textContent = line.merchandise.product.title;

                // Set selected option
                const optionEl = itemEl.querySelector(
                    "[data-bf-line-selected-option]"
                );

                if (optionEl) {
                    optionEl.textContent = line.merchandise.title;
                }

                // Set quantity
                const qtyEl = itemEl.querySelector("[data-bf-line-qty]");
                if (qtyEl) qtyEl.textContent = line.quantity;

                // Set amount per qty
                const perQtyEl = itemEl.querySelector(
                    "[data-bf-line-amount-per-qty]"
                );
                if (perQtyEl && line.cost && line.cost.amountPerQuantity) {
                    perQtyEl.textContent = this._formatMoney(
                        line.cost.amountPerQuantity.amount,
                        line.cost.amountPerQuantity.currencyCode
                    );
                }

                // Set total amount
                const totalEl = itemEl.querySelector(
                    "[data-bf-line-total-amount]"
                );
                if (totalEl && line.cost && line.cost.totalAmount) {
                    totalEl.textContent = this._formatMoney(
                        line.cost.totalAmount.amount,
                        line.cost.totalAmount.currencyCode
                    );
                }

                // Set remove button
                const removeBtn = itemEl.querySelector(
                    "[data-bf-remove-line-item]"
                );
                if (removeBtn) {
                    removeBtn.onclick = async (e) => {
                        e.preventDefault();
                        await this._removeLineItem(line.id);
                        await this._refreshCart();
                    };
                }
            });

            // Hide the template if more than one item
            if (this._cart.lines.edges.length > 1) template.style.display = "";
        });
    }

    async _fetchShopMoneyFormat() {
        const query = `
        {
            shop {
                name
                moneyFormat
            }
        }
    `;
        const res = await this._executeShopifyQuery(query);
        this._moneyFormat =
            res?.data?.shop?.moneyFormat || "{{amount}}{{currency_code}}";
    }

    /**
     * Formats a money amount using the shop's moneyFormat.
     * @param {string|number} amount
     * @param {string} currency
     * @returns {string}
     */
    _formatMoney(amount, currency) {
        let formatted = this._moneyFormat || "${{amount}}";
        // Replace {{amount}} with the value, fixed to 2 decimals
        formatted = formatted.replace(
            "{{amount}}",
            parseFloat(amount).toFixed(2)
        );
        // Optionally replace currency code if present
        formatted = formatted.replace("{{currency_code}}", currency || "");
        return formatted;
    }

    /**
     * @param {HTMLElement} subTotalElem - Element to update with subtotal.
     * @param {HTMLElement} totalElem - Element to update with total.
     * Updates subtotal and total cart amount.
     */
    _updateCartTotals(subTotalElem, totalElem) {
        if (!this._cart || !this._cart.estimatedCost) {
            console.warn("[Blink] No cart or estimated cost available.");
            return;
        }

        const subtotal = this._cart?.estimatedCost?.subtotalAmount?.amount || 0;
        const subtotalCurrency =
            this._cart?.estimatedCost?.subtotalAmount?.currencyCode || "USD";
        const total = this._cart?.estimatedCost?.totalAmount?.amount || 0;
        const totalCurrency =
            this._cart?.estimatedCost?.totalAmount?.currencyCode || "USD";

        if (subTotalElem) {
            subTotalElem.textContent = this._formatMoney(
                subtotal,
                subtotalCurrency
            );
        }
        if (totalElem) {
            totalElem.textContent = this._formatMoney(total, totalCurrency);
        }
    }

    /**
     * @param {string} lineId - The ID of the line item to remove.
     * Removes a line item from the cart by line ID.
     */
    async _removeLineItem(lineId) {
        const query = `
        mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
            cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
                cart { id }
                userErrors { field message }
            }
        }
    `;
        const variables = { cartId: this.cartId, lineIds: [lineId] };
        await this._executeShopifyQuery(query, variables);
    }

    /**
     * Fetches the latest cart and re-renders.
     */
    async _refreshCart() {
        this._cart = await this._fetchCart(this.cartId);
        localStorage.setItem(this._cartStorageKey, JSON.stringify(this._cart));
        this._renderCart();
    }

    get token() {
        return this._storeToken;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    window.Blink = new GlobalBlink();
});
