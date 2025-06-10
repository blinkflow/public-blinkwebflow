import { MoneyFormatter } from "../utils.js";

export class ProductUI {
    constructor(productManager, cart, moneyFormatGetter) {
        this.productManager = productManager;
        this.cart = cart;
        this.getMoneyFormat = moneyFormatGetter; // function to get moneyFormat
    }

    async init() {
        await this.productManager.fetchAllProductsOnPage();
        this.renderProductPrices();
        this.setupAddToCartButtons();
    }

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

    setupAddToCartButtons(loaderSVG, checkSVG, setButtonLoading, openCartDrawer) {
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
                this.handleAddToCart(
                    button,
                    loaderSVG,
                    checkSVG,
                    setButtonLoading,
                    openCartDrawer
                );
            });
        });
    }

    handleAddToCart(button, loaderSVG, checkSVG, setButtonLoading, openCartDrawer) {
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
}
