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

        this.templates = {}; // Will be filled at runtime from DOM
    }

    /**
     * Initializes product UI, fetches products, renders prices, sets up buttons, and renders galleries.
     * @returns {Promise<void>}
     */
    async init() {
        await this.productManager.fetchAllProductsOnPage();
        this.renderProductPrices();
        this.setupAddToCartButtons();
        this.renderProductGalleries();
    }

    /**
     * Renders product image galleries, thumbnails, and slider controls.
     * Fetches templates from DOM.
     */
    renderProductGalleries() {
        document
            .querySelectorAll("[data-bf-product-gallery]")
            .forEach((galleryEl) => {
                const productEl = galleryEl.closest("[data-bf-product-id]");
                if (!productEl) return;
                const productId = productEl.getAttribute("data-bf-product-id");
                const product = this.productManager.currentProducts[productId];
                if (!product || !product.images?.edges?.length) return;

                const images = product.images.edges.map((edge) => edge.node);
                let activeIndex = 0;

                // Get slider and thumbnails wrapper
                const sliderEl = galleryEl.querySelector(
                    "[data-bf-product-image-slider]"
                );
                const thumbnailsWrapper = galleryEl.querySelector(
                    "[data-bf-thumbnail-wrapper]"
                );
                if (!sliderEl || !thumbnailsWrapper) return;

                // Fetch templates from DOM if not already
                if (!this.templates.activeImage) {
                    const activeImageTemplate = sliderEl.querySelector(
                        "[data-bf-product-image]"
                    );
                    if (activeImageTemplate) {
                        this.templates.activeImage =
                            activeImageTemplate.cloneNode(true);
                        this.templates.activeImage.style.display = "none";
                    }
                }
                if (!this.templates.thumbnailImage) {
                    const thumbTemplate = thumbnailsWrapper.querySelector(
                        "[data-bf-thumbnail-image]"
                    );
                    if (thumbTemplate) {
                        this.templates.thumbnailImage =
                            thumbTemplate.cloneNode(true);
                        this.templates.thumbnailImage.style.display = "none";
                    }
                }

                // Remove all but template in slider and thumbnails
                sliderEl
                    .querySelectorAll("[data-bf-product-image]")
                    .forEach((el) => {
                        if (
                            this.templates.activeImage &&
                            el !== this.templates.activeImage
                        )
                            el.remove();
                    });
                thumbnailsWrapper
                    .querySelectorAll("[data-bf-thumbnail-image]")
                    .forEach((el) => {
                        if (
                            this.templates.thumbnailImage &&
                            el !== this.templates.thumbnailImage
                        )
                            el.remove();
                    });

                // Render all images in slider ONCE
                const sliderImages = [];
                images.forEach((img, idx) => {
                    let imgEl = this.templates.activeImage
                        ? this.templates.activeImage.cloneNode(true)
                        : document.createElement("img");
                    imgEl.setAttribute("data-bf-product-image", "");
                    imgEl.src = img.url;
                    imgEl.alt = img.altText || product.title || "";
                    imgEl.style.display = idx === activeIndex ? "" : "none";
                    imgEl.classList.toggle("active", idx === activeIndex);
                    sliderEl.appendChild(imgEl);
                    sliderImages.push(imgEl);
                });

                // Render all thumbnails ONCE
                const thumbnailImages = [];
                images.forEach((img, idx) => {
                    let thumbEl = this.templates.thumbnailImage
                        ? this.templates.thumbnailImage.cloneNode(true)
                        : document.createElement("img");
                    thumbEl.setAttribute("data-bf-thumbnail-image", "");
                    thumbEl.src = img.url;
                    thumbEl.alt = img.altText || product.title || "";
                    thumbEl.setAttribute("data-index", idx);
                    thumbEl.style.display = "";
                    thumbEl.classList.toggle("active", idx === activeIndex);
                    thumbEl.onclick = () => {
                        setActiveIndex(idx);
                    };
                    thumbnailsWrapper.appendChild(thumbEl);
                    thumbnailImages.push(thumbEl);
                });

                // Function to update active image and thumbnail
                function setActiveIndex(idx) {
                    activeIndex = idx;
                    sliderImages.forEach((imgEl, i) => {
                        imgEl.style.display = i === activeIndex ? "" : "none";
                        imgEl.classList.toggle("active", i === activeIndex);
                    });
                    thumbnailImages.forEach((thumbEl, i) => {
                        thumbEl.classList.toggle("active", i === activeIndex);
                    });
                }

                // Setup arrow navigation using DOM elements
                const arrowLeft = sliderEl.querySelector(
                    "[data-bf-image-slider-arrow-left]"
                );
                const arrowRight = sliderEl.querySelector(
                    "[data-bf-image-slider-arrow-right]"
                );
                if (arrowLeft) {
                    arrowLeft.onclick = () => {
                        setActiveIndex(
                            (activeIndex - 1 + images.length) % images.length
                        );
                    };
                }
                if (arrowRight) {
                    arrowRight.onclick = () => {
                        setActiveIndex((activeIndex + 1) % images.length);
                    };
                }
            });
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
     */
    setupAddToCartButtons() {
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

        this.setButtonLoading(button, true);
        this.cart
            .addToCart({ variantId, quantity })
            .then(() => {
                button.innerHTML = this._checkSVG;
                setTimeout(() => {
                    this.setButtonLoading(button, false);
                }, 1500);
                this.cartUI.openCartDrawer();
            })
            .catch((err) => {
                button.innerHTML = "Error";
                setTimeout(() => {
                    this.setButtonLoading(button, false);
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
