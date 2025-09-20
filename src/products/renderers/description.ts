import { Renderer } from '@/products/renderer-base';
import Product from '@/products/product';

export default class DescriptionRenderer extends Renderer {
	constructor(product: Product, container: HTMLElement) {
		super(product, container);
	}
	render(): void {
		this.container.innerHTML = this.product.details.descriptionHtml;
	}
}
