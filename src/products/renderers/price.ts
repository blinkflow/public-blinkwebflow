import { Renderer } from '@/products/renderer-base';
import { formatCurrency } from '@/utils/currency';
import { subscribeEvent } from '@/utils/events';
import Product from '@/products/product';

export default class PriceRenderer extends Renderer {
	constructor(
		product: Product,
		container: HTMLElement,
		private moneyFormat: string,
	) {
		super(product, container);
		subscribeEvent('product:variant-change', (detail) => {
			if (detail?.productId === this.product.id) {
				this.render();
			}
		});
	}

	render(): void {
		const selectedVariant = this.product.selectedVariant;
		this.container.textContent = formatCurrency(
			selectedVariant.price.amount,
			selectedVariant.price.currencyCode,
			this.moneyFormat,
		);
	}
}
