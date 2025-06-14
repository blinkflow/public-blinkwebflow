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
        this.selectedVariants = new Map(); // Track selected variants per product
        this._loaderSVG = `
        <svg class="bf-loader-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        this.renderProductDetails();
        this.setupProductOptions();
        this.setupAddToCartButtons();
        this.renderProductGalleries();
    }

    /**
     * Sets up product options for all products on the page.
     */
    setupProductOptions() {
        document.querySelectorAll("[data-bf-product-option]").forEach((container) => {
            const productEl = container.closest("[data-bf-product-id]");
            if (!productEl) return;

            const productId = productEl.getAttribute("data-bf-product-id");
            const product = this.productManager.currentProducts[productId];
            if (!product) return;

            const optionName = container.getAttribute("data-bf-product-option-name");
            if (optionName && optionName !== "{{ Connect Your Shopify Product Option Name }}") {
                this.renderProductOption(container, product, optionName);
            } else {
                container.style.display = "none"; // Hide if no valid option name
            }
        });

        // After all options are rendered, update availability for all products
        document.querySelectorAll("[data-bf-product-id]").forEach((productEl) => {
            const productId = productEl.getAttribute("data-bf-product-id");
            const product = this.productManager.currentProducts[productId];
            if (product) {
                this.updateOptionAvailability(productEl, product);
            }
        });
    }

    /**
     * Renders a single product option container.
     * @param {HTMLElement} container
     * @param {object} product
     * @param {string} optionName
     */
    renderProductOption(container, product, optionName) {
        const option = product.options?.find((opt) => opt.name.toLowerCase() === optionName.toLowerCase());
        if (!option) return;

        // Update option name display
        const nameElement = container.querySelector('[data-bf-product-option-name="1"]');
        if (nameElement) {
            nameElement.textContent = option.name;
        }

        // Find or create values container
        let valuesContainer = container.querySelector("[data-bf-product-option-values-container]");
        if (!valuesContainer) {
            valuesContainer = container;
        }

        // Get template from existing option value element
        const template = valuesContainer.querySelector("[data-bf-product-option-value]");
        if (!template) return;

        const templateClone = template.cloneNode(true);
        template.style.display = "none";

        // Clear existing values except template
        valuesContainer.querySelectorAll("[data-bf-product-option-value]").forEach((el) => {
            if (el !== template) el.remove();
        });

        // Render each option value
        option.optionValues.forEach((optionValue, index) => {
            const valueElement = this.createOptionValueElement(templateClone, optionValue, option.name, product);
            valuesContainer.appendChild(valueElement);

            // Auto-select first option value
            if (index === 0) {
                this.selectOptionValue(valueElement, optionValue, option.name, product, false);
            }
        });
    }

    /**
     * Creates an option value element from template.
     * @param {HTMLElement} template
     * @param {object} optionValue
     * @param {string} optionName
     * @param {object} product
     * @returns {HTMLElement}
     */
    createOptionValueElement(template, optionValue, optionName, product) {
        const element = template.cloneNode(true);
        element.style.display = "";
        element.setAttribute("data-option-value", optionValue.name);
        element.setAttribute("data-option-name", optionName);

        // Handle image display
        const imageEl = element.querySelector("[data-bf-product-option-value-image]");
        if (imageEl && optionValue.swatch?.image) {
            const img = imageEl.querySelector("img") || document.createElement("img");
            img.src = optionValue.swatch.image.previewImage.url;
            img.alt = optionValue.swatch.image.alt || optionValue.name;
            if (!imageEl.querySelector("img")) {
                imageEl.appendChild(img);
            }
            imageEl.style.display = "";
        } else if (imageEl) {
            imageEl.style.display = "none";
        }

        // Handle color display (only if no image)
        const colorEl = element.querySelector("[data-bf-product-option-value-color]");
        if (colorEl && optionValue.swatch?.color && !optionValue.swatch?.image) {
            colorEl.style.backgroundColor = optionValue.swatch.color;
            colorEl.style.display = "";
        } else if (colorEl) {
            colorEl.style.display = "none";
        }

        // Handle text display
        const textEl = element.querySelector("[data-bf-product-option-value-text]");
        if (textEl) {
            textEl.textContent = optionValue.name;
            // Show text if no image/color, or always show as label
            textEl.style.display = "";
        }

        // Set up click handler
        element.addEventListener("click", () => {
            this.handleOptionSelection(element, optionValue, optionName, product);
        });

        return element;
    }

    /**
     * Handles option value selection.
     * @param {HTMLElement} element
     * @param {object} optionValue
     * @param {string} optionName
     * @param {object} product
     */
    handleOptionSelection(element, optionValue, optionName, product) {
        this.selectOptionValue(element, optionValue, optionName, product, true);
    }

    /**
     * Selects an option value and updates the UI accordingly.
     * @param {HTMLElement} element
     * @param {object} optionValue
     * @param {string} optionName
     * @param {object} product
     * @param {boolean} updateAvailability - Whether to update availability of other options
     */
    selectOptionValue(element, optionValue, optionName, product, updateAvailability = true) {
        const productEl = element.closest("[data-bf-product-id]");
        const productId = product.id;

        // Remove selected class from siblings
        const container = element.closest("[data-bf-product-option]");
        container.querySelectorAll("[data-bf-product-option-value]").forEach((sibling) => {
            sibling.classList.remove("bf-selected");
        });

        // Add selected class to clicked element
        element.classList.add("bf-selected");

        // Update selected options for this product
        if (!this.selectedVariants.has(productId)) {
            this.selectedVariants.set(productId, new Map());
        }
        this.selectedVariants.get(productId).set(optionName, optionValue.name);

        // Find matching variant
        const selectedVariant = this.findMatchingVariant(product, this.selectedVariants.get(productId));

        // Update product display
        this.updateProductDisplay(productEl, product, selectedVariant);

        // Update availability of other options
        if (updateAvailability) {
            this.updateOptionAvailability(productEl, product);
        }
    }

    /**
     * Finds the variant that matches the selected options.
     * @param {object} product
     * @param {Map} selectedOptions
     * @returns {object|null}
     */
    findMatchingVariant(product, selectedOptions) {
        if (!product.variants?.edges) return null;

        return (
            product.variants.edges.find((edge) => {
                const variant = edge.node;
                return variant.selectedOptions.every((option) => selectedOptions.get(option.name) === option.value);
            })?.node || null
        );
    }

    /**
     * Updates product display with selected variant data.
     * @param {HTMLElement} productEl
     * @param {object} product
     * @param {object|null} variant
     */
    updateProductDisplay(productEl, product, variant) {
        if (!variant) {
            variant = product.variants?.edges?.[0]?.node;
        }
        if (!variant) return;

        // Update price
        const priceEl = productEl.querySelector("[data-bf-product-price]");
        if (priceEl && variant.price) {
            priceEl.textContent = MoneyFormatter.format(
                variant.price.amount,
                variant.price.currencyCode,
                this.getMoneyFormat()
            );
        }

        // Update compare at price
        const compareAtEl = productEl.querySelector("[data-bf-product-compare-at-price]");
        if (compareAtEl && variant.compareAtPrice?.amount) {
            compareAtEl.textContent = MoneyFormatter.format(
                variant.compareAtPrice.amount,
                variant.compareAtPrice.currencyCode,
                this.getMoneyFormat()
            );
            compareAtEl.style.display = "";
        } else if (compareAtEl) {
            compareAtEl.style.display = "none";
        }

        // Update variant image if available
        if (variant.image) {
            const mainImage = productEl.querySelector("[data-bf-product-image]");
            if (mainImage) {
                mainImage.src = variant.image.src;
                mainImage.alt = variant.image.altText || product.title;
            }
        }

        // Update add to cart button
        const addToCartBtn = productEl.querySelector("[data-bf-add-to-cart]");
        if (addToCartBtn) {
            if (variant.availableForSale) {
                addToCartBtn.disabled = false;
                addToCartBtn.innerHTML = addToCartBtn.dataset.originalText || "Add to Cart";
            } else {
                addToCartBtn.disabled = true;
                addToCartBtn.innerHTML = "Out of Stock";
            }
        }
    }

    /**
     * Updates availability status of option values.
     * @param {HTMLElement} productEl
     * @param {object} product
     */
    updateOptionAvailability(productEl, product) {
        const productId = productEl.getAttribute("data-bf-product-id");
        const currentSelections = this.selectedVariants.get(productId) || new Map();

        productEl.querySelectorAll("[data-bf-product-option]").forEach((optionContainer) => {
            const optionName = optionContainer.getAttribute("data-bf-product-option-name");

            optionContainer.querySelectorAll("[data-bf-product-option-value]").forEach((valueEl) => {
                const optionValue = valueEl.getAttribute("data-option-value");
                if (!optionValue) return;

                // Create test selection with this option value
                const testSelections = new Map(currentSelections);
                testSelections.set(optionName, optionValue);

                // Check if any variant matches this combination
                const hasAvailableVariant = product.variants?.edges?.some((edge) => {
                    const variant = edge.node;
                    const matchesSelection = variant.selectedOptions.every((option) => {
                        const selectedValue = testSelections.get(option.name);
                        return !selectedValue || selectedValue === option.value;
                    });
                    return matchesSelection && variant.availableForSale;
                });

                if (hasAvailableVariant) {
                    valueEl.classList.remove("bf-unavailable");
                } else {
                    valueEl.classList.add("bf-unavailable");
                }
            });
        });
    }

    /**
     * Renders product image galleries, thumbnails, and slider controls.
     * Fetches templates from DOM.
     */
    renderProductGalleries() {
        document.querySelectorAll("[data-bf-product-gallery]").forEach((galleryEl) => {
            const productEl = galleryEl.closest("[data-bf-product-id]");
            if (!productEl) return;
            const productId = productEl.getAttribute("data-bf-product-id");
            const product = this.productManager.currentProducts[productId];
            if (!product || !product.images) return;

            const images = product.images.edges.map((edge) => edge.node);
            let activeIndex = 0;

            // Get slider and thumbnails wrapper
            const sliderEl = galleryEl.querySelector("[data-bf-product-image-slider]");
            const thumbnailsWrapper = galleryEl.querySelector("[data-bf-thumbnail-wrapper]");
            if (!sliderEl && !thumbnailsWrapper) return;

            const sliderImages = [];
            const thumbnailImages = [];

            if (sliderEl) {
                // Fetch templates from DOM if not already
                if (!this.templates.activeImage) {
                    const activeImageTemplate = sliderEl.querySelector("[data-bf-product-image]");
                    if (activeImageTemplate) {
                        this.templates.activeImage = activeImageTemplate.cloneNode(true);
                        this.templates.activeImage.style.display = "none";
                    }
                }
                // Remove all but template in slider
                sliderEl.querySelectorAll("[data-bf-product-image]").forEach((el) => {
                    if (this.templates.activeImage && el !== this.templates.activeImage) el.remove();
                });

                // Render all images in slider ONCE

                images.forEach((img, idx) => {
                    let imgEl = this.templates.activeImage
                        ? this.templates.activeImage.cloneNode(true)
                        : document.createElement("img");
                    imgEl.setAttribute("data-bf-product-image", "");
                    imgEl.src = img.src;
                    imgEl.alt = img.altText || product.title || "";
                    imgEl.style.display = idx === activeIndex ? "" : "none";
                    imgEl.classList.toggle("active", idx === activeIndex);
                    sliderEl.appendChild(imgEl);
                    sliderImages.push(imgEl);
                });
            }

            if (thumbnailsWrapper) {
                if (!this.templates.thumbnailImage) {
                    const thumbTemplate = thumbnailsWrapper.querySelector("[data-bf-thumbnail-image]");
                    if (thumbTemplate) {
                        this.templates.thumbnailImage = thumbTemplate.cloneNode(true);
                        this.templates.thumbnailImage.style.display = "none";
                    }
                }

                // Remove all but template in thumbnails wrapper
                thumbnailsWrapper.querySelectorAll("[data-bf-thumbnail-image]").forEach((el) => {
                    if (this.templates.thumbnailImage && el !== this.templates.thumbnailImage) el.remove();
                });

                // Render all thumbnails ONCE
                images.forEach((img, idx) => {
                    let thumbEl = this.templates.thumbnailImage
                        ? this.templates.thumbnailImage.cloneNode(true)
                        : document.createElement("img");
                    thumbEl.setAttribute("data-bf-thumbnail-image", "");
                    thumbEl.src = img.src;
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
            }

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
            const arrowLeft = sliderEl.querySelector("[data-bf-image-slider-arrow-left]");
            const arrowRight = sliderEl.querySelector("[data-bf-image-slider-arrow-right]");
            if (images.length <= 1) {
                if (arrowLeft) arrowLeft.style.display = "none";
                if (arrowRight) arrowRight.style.display = "none";
                return; // No need for arrows if only one image
            }

            if (arrowLeft) {
                arrowLeft.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIndex((activeIndex - 1 + images.length) % images.length);
                };
            }
            if (arrowRight) {
                arrowRight.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIndex((activeIndex + 1) % images.length);
                };
            }
        });
    }

    /**
     * Renders product details: title, description, prices, and compare-at prices on the page.
     */
    renderProductDetails() {
        document.querySelectorAll("[data-bf-product-id]").forEach((productEl) => {
            const productId = productEl.getAttribute("data-bf-product-id");
            const product = this.productManager.currentProducts[productId];
            if (!product) return;

            // Render product title
            const titleEl = productEl.querySelector("[data-bf-product-title]");

            if (titleEl) {
                titleEl.textContent = product.title ? product.title : "";
            }

            // Render product description
            const descEl = productEl.querySelector("[data-bf-product-description]");
            if (descEl) {
                descEl.innerHTML = product.descriptionHtml ? product.descriptionHtml : "";
            }

            // Get first variant
            const variant = product.variants?.edges?.[0]?.node;
            if (!variant) return;

            // Render price
            const priceEl = productEl.querySelector("[data-bf-product-price]");
            if (priceEl && variant.price) {
                priceEl.textContent = MoneyFormatter.format(
                    variant.price.amount,
                    variant.price.currencyCode,
                    this.getMoneyFormat()
                );
            }

            // Render compare at price
            const compareAtEl = productEl.querySelector("[data-bf-product-compare-at-price]");
            if (compareAtEl && variant.compareAtPrice && variant.compareAtPrice.amount) {
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
        const productId = productEl.dataset.bfProductId;

        const quantity = quantityEl ? parseInt(quantityEl.value, 10) : 1;

        const product = this.productManager.currentProducts[productId];
        if (!product) {
            console.error("[Blink] Product not found in currentProducts:", productId);
            return;
        }

        // Get selected variant or default to first variant
        let variant = null;
        const selectedOptions = this.selectedVariants.get(productId);
        if (selectedOptions && selectedOptions.size > 0) {
            variant = this.findMatchingVariant(product, selectedOptions);
        }

        if (!variant) {
            variant = product?.variants?.edges?.[0]?.node;
        }

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
