import { Renderer } from '@/products/renderer-base';
import { formatCurrency } from '@/utils/currency';
import { subscribeEvent } from '@/utils/events';
import Product from '@/products/product';

export default class CompareAtPriceRenderer extends Renderer {
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
		if (selectedVariant.compareAtPrice && selectedVariant.compareAtPrice.amount) {
			this.container.textContent = formatCurrency(
				selectedVariant.compareAtPrice.amount,
				selectedVariant.compareAtPrice.currencyCode,
				this.moneyFormat,
			);
			this.container.style.display = '';
		} else {
			this.container.style.display = 'none';
		}
	}
}
