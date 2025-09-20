import { Renderer } from '@/products/renderer-base';
import { subscribeEvent } from '@/utils/events';
import Product from '@/products/product';
import { logger } from '@/utils/error';

const SPINNER_SVG = `
<svg class="bf-loader-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="12" cy="12" r="10" stroke-opacity="0.2"/>
<path d="M22 12a10 10 0 0 1-10 10" />
<style>
		.bf-loader-svg { animation: bf-rotate 1s linear infinite; vertical-align: middle;}
		@keyframes bf-rotate { 100% { transform: rotate(360deg); } }
</style>
</svg>
`;

const CHECK_SVG = `
<svg class="bf-check-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M20 6 9 17l-5-5"/>
</svg>
`;

export default class AddToCartRenderer extends Renderer {
	private defaultContent: string;

	constructor(product: Product, container: HTMLElement) {
		super(product, container);
		this.defaultContent = container.innerHTML;
		this.container.addEventListener('click', this.addToCart.bind(this));
		subscribeEvent('product:variant-change', (detail) => {
			if (detail?.productId === this.product.id) {
				this.render();
			}
		});
	}

	render(): void {
		const variant = this.product.selectedVariant;

		if (!variant || !variant.availableForSale) {
			this.container.setAttribute('disabled', 'true');
			this.container.textContent = 'Sold Out';
		} else {
			this.container.removeAttribute('disabled');
			this.container.innerHTML = this.defaultContent;
		}
	}

	async addToCart(e: Event): Promise<void> {
		e.preventDefault();
		if (this.product.selectedVariant && this.product.selectedVariant.availableForSale) {
			this.container.innerHTML = SPINNER_SVG;
			this.container.setAttribute('disabled', 'true');
			try {
				await this.product.addToCart();
				this.container.innerHTML = CHECK_SVG;
				setTimeout(() => {
					this.render();
				}, 2000);
			} catch (e) {
				logger.error('Failed to add product to cart', e);
				this.container.textContent = 'Error. Try Again';
			}
			this.container.removeAttribute('disabled');
		}
	}
}
