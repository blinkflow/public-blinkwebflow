import { Renderer } from '@/products/renderer-base';
import Product from '@/products/product';

export default class QuantityRenderer extends Renderer {
	constructor(product: Product, container: HTMLElement) {
		super(product, container);
	}
	render(): void {}
}
