import { MoneyFormatter } from "../utils.js";

/**
 * Handles rendering and UI interactions for the cart.
 */
export class CartUI {
    /**
     * @param {object} cart - Cart instance.
     */
    constructor(cart) {
        this.cart = cart;
        this._templates = {};
        // Subscribe to cart changes
        this.cart.onCartChange = () => this.renderCart();
    }

    /**
     * Initializes cart UI, sets up event listeners.
     * @returns {Promise<void>}
     */
    async init() {
        this.closeCartDrawer();
        this._setupCartTriggerButtons();
        this._setupCheckoutButtons();
        this._setupClearCartButtons();
        this.renderCart();
    }

    /**
     * Renders the cart contents in the UI.
     */
    renderCart() {
        const cartData = this.cart._cart;
        document.querySelectorAll("[data-bf-cart]").forEach((cart) => {
            const cartItemsCountElem = cart.querySelector("[data-bf-cart-items-count]");

            let cartItemsCount = 0;

            const container = cart.querySelector("[data-bf-line-items]");
            if (!container) return;

            let template = this._templates.cartTemplate;
            if (!template) {
                template = container.querySelector("[data-bf-line-item]");
                if (!template) return;
                this._templates.cartTemplate = template.cloneNode(true);
            }
            template.style.display = "none";

            const emptyMessage = cart.querySelector("[data-bf-empty-cart-message]");
            if (emptyMessage) emptyMessage.style.display = "none";

            container.querySelectorAll("[data-bf-line-item]").forEach((el) => {
                if (el !== template) el.remove();
            });

            const subTotalElem = cart.querySelector("[data-bf-cart-subtotal]");
            const totalElem = cart.querySelector("[data-bf-cart-total]");
            this.updateCartTotals(subTotalElem, totalElem, cartData);

            if (!cartData || !cartData.lines || !cartData.lines.edges.length) {
                template.style.display = "none";
                if (cartItemsCountElem) {
                    cartItemsCountElem.style.display = "none";
                }
                if (emptyMessage) emptyMessage.style.display = "";
                return;
            }

            cartData.lines.edges.forEach((edge) => {
                cartItemsCount += edge.node.quantity;
                const line = edge.node;
                const itemEl = template.cloneNode(true);
                container.appendChild(itemEl);
                itemEl.style.display = "";

                const img = itemEl.querySelector("[data-bf-line-image]");
                if (img) {
                    img.src = line.merchandise.image?.url;
                    img.alt = line.merchandise.image?.altText || "";
                }

                const titleEl = itemEl.querySelector("[data-bf-line-title]");
                if (titleEl) titleEl.textContent = line.merchandise.product.title;

                const optionEl = itemEl.querySelector("[data-bf-line-selected-option]");
                if (optionEl) optionEl.textContent = line.merchandise.title;

                const qtyEl = itemEl.querySelector("[data-bf-line-qty]");
                if (qtyEl) qtyEl.textContent = line.quantity;

                const perQtyEl = itemEl.querySelector("[data-bf-line-amount-per-qty]");
                if (perQtyEl && line.cost && line.cost.amountPerQuantity) {
                    perQtyEl.textContent = MoneyFormatter.format(
                        line.cost.amountPerQuantity.amount,
                        line.cost.amountPerQuantity.currencyCode,
                        this.cart._moneyFormat
                    );
                }
                const totalEl = itemEl.querySelector("[data-bf-line-total-amount]");
                if (totalEl && line.cost && line.cost.totalAmount) {
                    totalEl.textContent = MoneyFormatter.format(
                        line.cost.totalAmount.amount,
                        line.cost.totalAmount.currencyCode,
                        this.cart._moneyFormat
                    );
                }

                const removeBtn = itemEl.querySelector("[data-bf-remove-line-item]");
                if (removeBtn) {
                    removeBtn.onclick = async (e) => {
                        e.preventDefault();
                        await this.cart.removeLineItem(line.id);
                        this.renderCart();
                    };
                }
            });

            if (cartItemsCountElem) {
                cartItemsCountElem.textContent = `(${cartItemsCount})`;
                if (cartItemsCount > 0) {
                    cartItemsCountElem.style.display = "";
                } else {
                    cartItemsCountElem.style.display = "none";
                }
            }

            if (cartData.lines.edges.length > 1) template.style.display = "";
        });
    }

    /**
     * Updates cart subtotal and total elements.
     * @param {HTMLElement} subTotalElem
     * @param {HTMLElement} totalElem
     * @param {object} cartData
     */
    updateCartTotals(subTotalElem, totalElem, cartData) {
        if (!cartData || !cartData?.estimatedCost) {
            if (subTotalElem) subTotalElem.textContent = MoneyFormatter.format(0, "USD");
            if (totalElem) totalElem.textContent = MoneyFormatter.format(0, "USD");
            return;
        }

        const subtotal = cartData?.estimatedCost?.subtotalAmount?.amount || 0;
        const subtotalCurrency = cartData?.estimatedCost?.subtotalAmount?.currencyCode || "USD";
        const total = cartData?.estimatedCost?.totalAmount?.amount || 0;
        const totalCurrency = cartData?.estimatedCost?.totalAmount?.currencyCode || "USD";

        if (subTotalElem) {
            subTotalElem.textContent = MoneyFormatter.format(subtotal, subtotalCurrency, this.cart._moneyFormat);
        }
        if (totalElem) {
            totalElem.textContent = MoneyFormatter.format(total, totalCurrency, this.cart._moneyFormat);
        }
    }

    /**
     * Sets up buttons that open/close the cart drawer.
     * @private
     */
    _setupCartTriggerButtons() {
        const cartOpenButtons = document.querySelectorAll("[data-bf-cart-drawer-open]");
        const cartCloseButtons = document.querySelectorAll("[data-bf-cart-drawer-close]");

        cartOpenButtons.forEach((button) => {
            button.addEventListener("click", () => this.openCartDrawer());
        });

        cartCloseButtons.forEach((button) => {
            button.addEventListener("click", () => this.closeCartDrawer());
        });
    }

    /**
     * Closes the cart drawer.
     * @param {HTMLElement} [cartDrawer]
     * @private
     */
    closeCartDrawer(cartDrawer) {
        const drawer = cartDrawer ? cartDrawer : document.querySelector("[data-bf-cart-drawer]");
        if (!drawer) {
            console.warn("[Blink] No cart drawer found to close.");
            return;
        }
        const activeClass = drawer.dataset.bfCartDrawerActiveClass ?? "bf-open";
        if (drawer) {
            drawer.classList.remove(activeClass);
            drawer.setAttribute("aria-hidden", "true");
        }
    }

    /**
     * Opens the cart drawer.
     * @param {HTMLElement} [cartDrawer]
     * @private
     */
    openCartDrawer(cartDrawer) {
        const drawer = cartDrawer ? cartDrawer : document.querySelector("[data-bf-cart-drawer]");
        const activeClass = drawer.dataset.bfCartDrawerActiveClass ?? "bf-open";
        if (!drawer) {
            console.warn("[Blink] No cart drawer found to open.");
            return;
        }
        if (drawer) {
            drawer.classList.add(activeClass);
            drawer.setAttribute("aria-hidden", "false");
        }
    }

    /**
     * Sets up checkout buttons to redirect to checkout URL.
     * @private
     */
    _setupCheckoutButtons() {
        const checkoutButtons = document.querySelectorAll("[data-bf-checkout]");
        checkoutButtons.forEach((button) => {
            button.addEventListener("click", (e) => {
                e.preventDefault();
                if (this.cart._cart && this.cart._cart.checkoutUrl) {
                    window.location.href = this.cart._cart.checkoutUrl;
                } else {
                    console.warn("[Blink] No checkoutUrl available on cart.");
                }
            });
        });
    }

    /**
     * Sets up clear cart buttons to empty the cart.
     * @private
     */
    _setupClearCartButtons() {
        const clearButtons = document.querySelectorAll("[data-bf-clear-cart]");
        clearButtons.forEach((button) => {
            button.addEventListener("click", async (e) => {
                e.preventDefault();
                await this.cart.clearCart();
                this.renderCart();
            });
        });
    }
}
