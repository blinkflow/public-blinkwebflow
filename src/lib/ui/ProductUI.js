import { MoneyFormatter } from "../utils.js";

/**
 * Handles rendering and UI interactions for products.
 */
export class ProductUI {
    /**
     * @param {object} productManager - ProductManager instance.
     * @param {object} cart - Cart instance.
     * @param {object} cartUI - CartUI instance.
     * @param {function} moneyFormatGetter - Function returning money format string.
     */
    constructor(productManager, cart, cartUI, moneyFormatGetter) {
        this.productManager = productManager;
        this.cart = cart;
        this.cartUI = cartUI;
        this.getMoneyFormat = moneyFormatGetter; // function to get moneyFormat
        this._loaderSVG = `
        <svg class="bf-loader-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.2"/>
        <path d="M22 12a10 10 0 0 1-10 10" />
        <style>
            .bf-loader-svg { animation: bf-rotate 1s linear infinite; vertical-align: middle;}
            @keyframes bf-rotate { 100% { transform: rotate(360deg); } }
        </style>
        </svg>
        `;

        this._checkSVG = `
        <svg class="bf-check-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"/>
        </svg>
        `;
    }

    /**
     * Initializes product UI, fetches products, renders prices, sets up buttons.
     * @returns {Promise<void>}
     */
    async init() {
        await this.productManager.fetchAllProductsOnPage();
        this.renderProductPrices();
        this.setupAddToCartButtons();
    }

    /**
     * Renders product prices and compare-at prices on the page.
     */
    renderProductPrices() {
        document
            .querySelectorAll("[data-bf-product-id]")
            .forEach((productEl) => {
                const productId = productEl.getAttribute("data-bf-product-id");
                const product = this.productManager.currentProducts[productId];
                if (!product) return;

                // Get first variant
                const variant = product.variants?.edges?.[0]?.node;
                if (!variant) return;

                // Render price
                const priceEl = productEl.querySelector(
                    "[data-bf-product-price]"
                );
                if (priceEl && variant.price) {
                    priceEl.textContent = MoneyFormatter.format(
                        variant.price.amount,
                        variant.price.currencyCode,
                        this.getMoneyFormat()
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
                    compareAtEl.textContent = MoneyFormatter.format(
                        variant.compareAtPrice.amount,
                        variant.compareAtPrice.currencyCode,
                        this.getMoneyFormat()
                    );
                    compareAtEl.style.display = "";
                } else if (compareAtEl) {
                    compareAtEl.style.display = "none";
                }
            });
    }

    /**
     * Sets up add-to-cart buttons for all products.
     * @param {function} openCartDrawer
     */
    setupAddToCartButtons(openCartDrawer) {
        const buttons = document.querySelectorAll("[data-bf-add-to-cart]");

        buttons.forEach((button) => {
            const productEl = button.closest("[data-bf-product-id]");
            if (productEl) {
                const productId = productEl.getAttribute("data-bf-product-id");
                const product = this.productManager.currentProducts[productId];
                const variant = product?.variants?.edges?.[0]?.node;
                if (!variant || !variant.availableForSale) {
                    button.disabled = true;
                    button.innerHTML = "Out of stock";
                }
            }

            button.addEventListener("click", (e) => {
                e.preventDefault();
                this.handleAddToCart(button);
            });
        });
    }

    /**
     * Handles add-to-cart button click.
     * @param {HTMLElement} button
     */
    handleAddToCart(button) {
        const productEl = button.closest("[data-bf-product-id]");
        const quantityEl = productEl?.querySelector("[data-bf-qty]");

        const quantity = quantityEl ? parseInt(quantityEl.value, 10) : 1;

        const product =
            this.productManager.currentProducts[productEl.dataset.bfProductId];
        if (!product) {
            console.error(
                "[Blink] Product not found in currentProducts:",
                productEl.dataset.bfProductId
            );
            return;
        }

        const variant = product?.variants?.edges?.[0]?.node;
        const variantId = variant?.id;

        if (!variant || !variant.availableForSale) {
            button.disabled = true;
            button.innerHTML = "Out of stock";
            return;
        }

        if (!variantId) {
            console.error("[Blink] Missing variant id.");
            return;
        }

        setButtonLoading(button, true);
        this.cart
            .addToCart({ variantId, quantity })
            .then(() => {
                button.innerHTML = checkSVG;
                setTimeout(() => {
                    setButtonLoading(button, false);
                }, 1500);
                openCartDrawer();
            })
            .catch((err) => {
                button.innerHTML = "Error";
                setTimeout(() => {
                    setButtonLoading(button, false);
                }, 1500);
                console.error("[Blink] Add to cart failed:", err);
            });
    }

    /**
     * Sets loading state on the given button.
     * @param {HTMLElement} button
     * @param {boolean} isLoading
     */
    setButtonLoading(button, isLoading) {
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
}
