import { ShopifyClient } from "./ShopifyClient.js";
import { ProductManager } from "./ProductManager.js";
import { Cart } from "./Cart.js";
import { Cache } from "./utils.js";
import { CartUI } from "./ui/CartUI.js";
import { ProductUI } from "./ui/ProductUI.js";

export class GlobalBlink {
    constructor(config = {}) {
        if (GlobalBlink._instance) return GlobalBlink._instance;
        GlobalBlink._instance = this;

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

        const token = config.shopify?.token || this._getTokenFromDOM();
        const storeDomain =
            config.shopify?.storeDomain || this._getStoreDomainFromDOM();
        if (!token || !storeDomain) {
            console.error(
                "[Blink] Shopify Token or Store Domain not provided or found in DOM."
            );
            return;
        }
        this.shopifyClient = new ShopifyClient({ token, storeDomain });

        this.productManager = new ProductManager(this.shopifyClient);
        this.cart = new Cart(this.shopifyClient, this.productManager);
        this.cartUI = new CartUI(this.cart);

        // Add ProductUI
        this.productUI = new ProductUI(
            this.productManager,
            this.cart,
            () => this.cart._moneyFormat // pass getter for moneyFormat
        );

        // Store info about the shop (shopName, moneyFormat)
        this.store = {
            shopName: null,
            moneyFormat: null,
        };
        this._init();
    }

    async _init() {
        await this.cart.init();
        await this.cartUI.init();
        await this.productUI.init();

        // Load shop info from localStorage if available
        const cached = Cache.get("blink_shop_info");
        if (cached) {
            try {
                const info = cached;
                this.store.shopName = info.shopName || null;
                this.store.moneyFormat = info.moneyFormat || null;
            } catch (e) {
                console.warn(
                    "[Blink] Invalid cached shop info, fetching fresh."
                );
            }
        }
        // If not cached, fetch from Shopify
        if (!this.store.shopName || !this.store.moneyFormat) {
            const query = `
            {
                shop {
                    name
                    moneyFormat
                }
            }
            `;
            const res = await this.shopifyClient.executeQuery(query);
            if (res?.data?.shop) {
                this.store.shopName = res.data.shop.name;
                this.store.moneyFormat = res.data.shop.moneyFormat;
                Cache.set(
                    "blink_shop_info",
                    {
                        shopName: this.store.shopName,
                        moneyFormat: this.store.moneyFormat,
                    },
                    1000 * 60 * 60 // 1 hour TTL for shop info
                );
            }
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
}