import { MoneyFormatter } from "../utils.js";

export class CartUI {
    constructor(cart) {
        this.cart = cart;
        this._templates = {};
        // Subscribe to cart changes
        this.cart.onCartChange = () => this.renderCart();
    }

    async init() {
        this._closeCartDrawer();
        this._setupCartTriggerButtons();
        this._setupCheckoutButtons();
        this._setupClearCartButtons();
        this.renderCart();
        // Listen for cart changes if needed (optional: use events or polling)
    }

    renderCart() {
        const cartData = this.cart._cart;
        document.querySelectorAll("[data-bf-cart]").forEach((cart) => {
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
                if (emptyMessage) emptyMessage.style.display = "";
                return;
            }

            cartData.lines.edges.forEach((edge) => {
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
                if (titleEl)
                    titleEl.textContent = line.merchandise.product.title;

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
                        await this.cart.refreshCart();
                        this.renderCart();
                    };
                }
            });

            if (cartData.lines.edges.length > 1) template.style.display = "";
        });
    }

    updateCartTotals(subTotalElem, totalElem, cartData) {
        if (!cartData) return;
        if (!cartData.estimatedCost) {
            if (subTotalElem) subTotalElem.textContent = MoneyFormatter.format(0, "USD");
            if (totalElem) totalElem.textContent = MoneyFormatter.format(0, "USD");
        }
        const subtotal = cartData?.estimatedCost?.subtotalAmount?.amount || 0;
        const subtotalCurrency = cartData?.estimatedCost?.subtotalAmount?.currencyCode || "USD";
        const total = cartData?.estimatedCost?.totalAmount?.amount || 0;
        const totalCurrency = cartData?.estimatedCost?.totalAmount?.currencyCode || "USD";

        if (subTotalElem) {
            subTotalElem.textContent = MoneyFormatter.format(
                subtotal,
                subtotalCurrency,
                this.cart._moneyFormat
            );
        }
        if (totalElem) {
            totalElem.textContent = MoneyFormatter.format(
                total,
                totalCurrency,
                this.cart._moneyFormat
            );
        }
    }

    _setupCartTriggerButtons() {
        const triggers = document.querySelectorAll("[data-bf-cart-trigger]");
        triggers.forEach((button) => {
            button.addEventListener("click", () => {
                const cartDrawer = document.querySelector("[data-bf-cart-drawer]");
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

    _closeCartDrawer(cartDrawer) {
        const drawer = cartDrawer
            ? cartDrawer
            : document.querySelector("[data-bf-cart-drawer]");
        if (drawer) {
            drawer.classList.remove("open");
            drawer.setAttribute("aria-hidden", "true");
        }
    }

    _openCartDrawer(cartDrawer) {
        const drawer = cartDrawer
            ? cartDrawer
            : document.querySelector("[data-bf-cart-drawer]");
        if (drawer) {
            drawer.classList.add("open");
            drawer.setAttribute("aria-hidden", "false");
        }
    }

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

    _setupClearCartButtons() {
        const clearButtons = document.querySelectorAll("[data-bf-clear-cart]");
        clearButtons.forEach((button) => {
            button.addEventListener("click", async (e) => {
                e.preventDefault();
                await this.cart.clearCart();
                await this.cart.refreshCart();
                this.renderCart();
            });
        });
    }
}
