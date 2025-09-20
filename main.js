import { ShopifyClient } from "./lib/ShopifyClient.js";
import { ProductManager } from "./lib/ProductManager.js";
import { Cart } from "./lib/Cart.js";
import { Cache } from "./lib/utils.js";
import { CartUI } from "./lib/ui/CartUI.js";
import { ProductUI } from "./lib/ui/ProductUI.js";


export class GlobalBlink {
    constructor(config = {}) {
        if (GlobalBlink._instance) return GlobalBlink._instance;
        GlobalBlink._instance = this;

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

        this.productUI = new ProductUI(
            this.productManager,
            this.cart,
            this.cartUI,
            () => this.cart._moneyFormat 
        );

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
