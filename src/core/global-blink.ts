import { createShopifyClient, ShopifyClient } from '@/utils/shopify-client';
import ProductManager from '@/core/product-manager';
import { Config, createConfig } from '@/config';
import fetchStoreDetails from '@/utils/store';
import Cart from './cart-manager';
import { Store } from '@/types';

export default class GlobalBlink {
	private config: Config;
	private shopifyClient: ShopifyClient;
	private productManager: ProductManager;
	public cart!: Cart;
	public store!: Store;
	public ready: Promise<void>;

	constructor() {
		this.config = createConfig();
		this.shopifyClient = createShopifyClient(this.config.shopify);
		this.productManager = new ProductManager(
			this.shopifyClient,
			this.config.cache.keys.products,
			this.config.cache.ttl.products,
		);
		this.ready = this.init();
	}

	private async init() {
		this.store = await fetchStoreDetails(this.shopifyClient, this.config.cache.keys.store, this.config.cache.ttl.store);
		await this.productManager.fetchProducts();
		this.cart = new Cart(
			this.shopifyClient,
			this.config.cache.keys.cart,
			this.config.cache.ttl.cart,
			this.store.moneyFormat || '${{amount}}',
		);
		this.cart.init();
	}

	public get products() {
		return this.productManager.currentProducts;
	}

	public getProductById(id: string) {
		return this.productManager.currentProducts.get(id);
	}
}
