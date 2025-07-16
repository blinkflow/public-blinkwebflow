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
        this.renderProductGalleries();
        this.setupProductOptions();
        if (this.isSingleProductPage()) {
            this.handleUrlVariantSelection();
        }
        this.setupAddToCartButtons();
    }

    /**
     * Checks if current page is a single product page (domain.com/products/slug format).
     * @returns {boolean}
     */
    isSingleProductPage() {
        const pathname = window.location.pathname;

        // Check if path matches /products/[slug] pattern
        const productPagePattern = /^\/products\/[^\/]+\/?$/;
        return productPagePattern.test(pathname);
    }

    /**
     * Handles variant selection from URL query parameter.
     */
    handleUrlVariantSelection() {
        const urlParams = new URLSearchParams(window.location.search);
        const variantId = urlParams.get("variant");

        if (!variantId) return;

        // Find the product that contains this variant
        for (const [productId, product] of Object.entries(this.productManager.currentProducts)) {
            const variantEdge = product.variants?.edges?.find(
                (edge) => edge.node.id === variantId || edge.node.id === `gid://shopify/ProductVariant/${variantId}`
            );

            if (variantEdge) {
                this.selectVariantFromUrl(productId, variantEdge.node);
                break;
            }
        }
    }

    /**
     * Selects a variant based on URL parameter.
     * @param {string} productId
     * @param {object} variant
     */
    selectVariantFromUrl(productId, variant) {
        const productEl = document.querySelector(`[data-bf-product-id="${productId}"]`);
        if (!productEl) return;

        const product = this.productManager.currentProducts[productId];
        if (!product) return;

        // Clear existing selections for this product
        this.selectedVariants.set(productId, new Map());

        // Select options based on variant's selectedOptions
        variant.selectedOptions.forEach((option) => {
            this.selectedVariants.get(productId).set(option.name, option.value);

            // Find and select the corresponding option value element
            const optionContainer = productEl.querySelector(`[data-bf-product-option-name="${option.name}"]`);
            if (optionContainer) {
                // Remove selected class from all values in this option
                optionContainer.querySelectorAll("[data-bf-product-option-value]").forEach((el) => {
                    el.classList.remove("bf-selected");
                });

                // Add selected class to the matching value
                const valueElement = optionContainer.querySelector(`[data-option-value="${option.value}"]`);
                if (valueElement) {
                    valueElement.classList.add("bf-selected");
                }
            }
        });

        // Update product display with the selected variant
        this.updateProductDisplay(productEl, product, variant);

        // Update availability of other options
        this.updateOptionAvailability(productEl, product);
    }

    /**
     * Sets up product options for all products on the page.
     */
    setupProductOptions() {
        const urlParams = new URLSearchParams(window.location.search);
        const hasUrlVariant = urlParams.has("variant");

        document.querySelectorAll("[data-bf-product-option]").forEach((container) => {
            const productEl = container.closest("[data-bf-product-id]");
            if (!productEl) return;

            const productId = productEl.getAttribute("data-bf-product-id");
            const product = this.productManager.currentProducts[productId];
            if (!product) return;

            const optionName = container.getAttribute("data-bf-product-option-name");
            if (optionName && optionName !== "{{ Connect Your Shopify Product Option Name }}") {
                this.renderProductOption(container, product, optionName, hasUrlVariant);
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
     * @param {boolean} hasUrlVariant - Whether URL contains variant parameter
     */
    renderProductOption(container, product, optionName, hasUrlVariant = false) {
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
        template.classList.remove("bf-selected", "bf-unavailable");
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

            // Auto-select first option value only if no URL variant is present
            if (index === 0 && !hasUrlVariant) {
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
        const productId = productEl.getAttribute("data-bf-product-id");

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

        if (this.isSingleProductPage()) {
            // Update URL with variant parameter
            this.updateUrlWithVariant(selectedVariant);
        }

        // Update product display
        this.updateProductDisplay(productEl, product, selectedVariant);

        // Update availability of other options
        if (updateAvailability) {
            this.updateOptionAvailability(productEl, product);
        }
    }

    /**
     * Updates the URL with the selected variant ID.
     * @param {object|null} variant
     */
    updateUrlWithVariant(variant) {
        if (!variant) return;

        const url = new URL(window.location);
        const numericVariantId = variant.id.split("/").pop(); // Extract numeric ID from GID

        url.searchParams.set("variant", numericVariantId);
        window.history.replaceState({}, "", url);
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
            })?.node || product.variants.edges[0]?.node
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
        const priceEls = productEl.querySelectorAll("[data-bf-product-price]");
        priceEls.forEach((priceEl) => {
            if (priceEl && variant.price) {
                priceEl.textContent = MoneyFormatter.format(
                    variant.price.amount,
                    variant.price.currencyCode,
                    this.getMoneyFormat()
                );
            }
        });

        // Update compare at price
        const compareAtEls = productEl.querySelector("[data-bf-product-compare-at-price]");
        compareAtEls.forEach((compareAtEl) => {
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
        });

        // Update variant image if available
        if (variant.image) {
            this.updateActiveImageByVariant(productEl, variant.image);
        }

        // Update add to cart button
        const addToCartBtns = productEl.querySelector("[data-bf-add-to-cart]");
        addToCartBtns.forEach((addToCartBtn) => {
            if (addToCartBtn) {
                if (variant.availableForSale) {
                    addToCartBtn.disabled = false;
                    addToCartBtn.innerHTML = addToCartBtn.dataset.originalText || "Add to Cart";
                } else {
                    addToCartBtn.disabled = true;
                    addToCartBtn.innerHTML = "Out of Stock";
                }
            }
        });
    }

    /**
     * Updates the active image in the gallery based on variant image.
     * @param {HTMLElement} productEl
     * @param {object} variantImage
     */
    updateActiveImageByVariant(productEl, variantImage) {
        const galleryEl = productEl.querySelector("[data-bf-product-gallery]");
        if (!galleryEl) return;

        const sliderEl = galleryEl.querySelector("[data-bf-product-image-slider]");
        const thumbnailsWrapper = galleryEl.querySelector("[data-bf-thumbnail-wrapper]");

        if (!sliderEl && !thumbnailsWrapper) return;

        // Find the index of the variant image in the gallery
        const sliderImages = sliderEl ? Array.from(sliderEl.querySelectorAll("[data-bf-product-image]")) : [];
        const thumbnailImages = thumbnailsWrapper
            ? Array.from(thumbnailsWrapper.querySelectorAll("[data-bf-thumbnail-image]"))
            : [];

        // Find matching image by src
        let targetIndex = -1;

        if (sliderImages.length > 0) {
            targetIndex = sliderImages.findIndex((img) => img.src === variantImage.src);
        } else if (thumbnailImages.length > 0) {
            targetIndex = thumbnailImages.findIndex((img) => img.src === variantImage.src);
        }

        if (targetIndex === -1) return; // Image not found in gallery

        // Update active states
        sliderImages.forEach((imgEl, index) => {
            if (index === targetIndex) {
                imgEl.style.display = "";
                imgEl.classList.add("active");
            } else {
                imgEl.style.display = "none";
                imgEl.classList.remove("active");
            }
        });

        thumbnailImages.forEach((thumbEl, index) => {
            if (index === targetIndex) {
                thumbEl.classList.add("active");
            } else {
                thumbEl.classList.remove("active");
            }
        });
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
            const titleEls = productEl.querySelectorAll("[data-bf-product-title]");

            titleEls.forEach((titleEl) => {
                titleEl.textContent = product.title ? product.title : "";
            });

            // Render product description
            const descEls = productEl.querySelectorAll("[data-bf-product-description]");

            descEls.forEach((descEl) => {
                descEl.innerHTML = product.descriptionHtml ? product.descriptionHtml : "";
            });

            // Get first variant
            const variant = product.variants?.edges?.[0]?.node;
            if (!variant) return;

            // Render price
            const priceEls = productEl.querySelectorAll("[data-bf-product-price]");
            priceEls.forEach((priceEl) => {
                if (variant.price) {
                    priceEl.textContent = MoneyFormatter.format(
                        variant.price.amount,
                        variant.price.currencyCode,
                        this.getMoneyFormat()
                    );
                }
            });

            // Render compare at price
            const compareAtEls = productEl.querySelectorAll("[data-bf-product-compare-at-price]");
            compareAtEls.forEach((compareAtEl) => {
                if (variant.compareAtPrice && variant.compareAtPrice.amount) {
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
                // Get variant from URL first, then selected variant, then default to first variant
                let variant = this.getVariantForProduct(productId, product);

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
     * Gets the appropriate variant for a product (URL variant, selected variant, or default).
     * @param {string} productId
     * @param {object} product
     * @returns {object|null}
     */
    getVariantForProduct(productId, product) {
        if (!product) return null;

        // First check for URL variant
        const urlParams = new URLSearchParams(window.location.search);
        const urlVariantId = urlParams.get("variant");

        if (urlVariantId) {
            const urlVariant = product.variants?.edges?.find(
                (edge) =>
                    edge.node.id === urlVariantId || edge.node.id === `gid://shopify/ProductVariant/${urlVariantId}`
            )?.node;

            if (urlVariant) {
                return urlVariant;
            }
        }

        // Then check for selected variant
        const selectedOptions = this.selectedVariants.get(productId);
        if (selectedOptions && selectedOptions.size > 0) {
            const selectedVariant = this.findMatchingVariant(product, selectedOptions);
            if (selectedVariant) {
                return selectedVariant;
            }
        }

        // Finally default to first variant
        return product?.variants?.edges?.[0]?.node || null;
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

        // Get variant from URL first, then selected variant, then default to first variant
        const variant = this.getVariantForProduct(productId, product);
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
