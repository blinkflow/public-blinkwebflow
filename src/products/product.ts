import isSingleProductPage from '@/products/utils/is-single-product-page';
import { mapGidToVariantId, mapVariantIdToGid } from '@/utils/id-mapper';
import { ShopifyProduct } from '@/types/products';
import GlobalBlink from '@/core/global-blink';
import { publishEvent } from '@/utils/events';
import { logger } from '@/utils/error';

export default class Product {
	public quantity = 1;
	public selectedVariantId: string;
	public details: ShopifyProduct;

	constructor(
		public id: string,
		private globalBlink: GlobalBlink,
	) {
		this.details = this.globalBlink.getProductById(this.id)!;
		this.selectedVariantId = this.details.variants.edges[0]?.node.id;
		if (!this.details) {
			throw logger.error(`Product with id ${this.id} not found`);
		}
		this.init();
	}

	init() {
		this.updateVariantFromUrl();
	}

	private updateVariantFromUrl() {
		if (isSingleProductPage()) {
			const urlParams = new URLSearchParams(window.location.search);
			const variantId = urlParams.get('variant');

			if (variantId) {
				const variantEdge = this.details.variants.edges.find((edge) => edge.node.id === mapVariantIdToGid(variantId));

				if (variantEdge) {
					this.selectVariant(variantEdge.node.id);
				}
			}
		}
	}

	async addToCart() {
		if (!this.selectedVariantId) {
			throw logger.error('No variant selected');
		}

		await this.globalBlink.cart.add({
			variantId: this.selectedVariantId,
			quantity: this.quantity,
		});
	}

	selectVariant(variantId: string) {
		this.selectedVariantId = variantId;
		if (isSingleProductPage()) {
			const url = new URL(window.location.href);
			url.searchParams.set('variant', mapGidToVariantId(variantId));
			window.history.replaceState({}, '', url.toString());
		}
		publishEvent('product:variant-change', { productId: this.id, variantId });
	}

	updateQuantity(quantity: number) {
		this.quantity = quantity;
		publishEvent('product:quantity-change', { productId: this.id, quantity });
	}

	get selectedVariant() {
		return this.details.variants.edges.find((edge) => edge.node.id === this.selectedVariantId)?.node!;
	}
}
