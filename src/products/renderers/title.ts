import { Renderer } from '@/products/renderer-base';
import Product from '@/products/product';

export default class TitleRenderer extends Renderer {
	constructor(product: Product, container: HTMLElement) {
		super(product, container);
	}
	render(): void {
		this.container.textContent = this.product.details.title;
	}
}
