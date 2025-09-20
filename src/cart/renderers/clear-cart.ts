import { Renderer } from '@/cart/renderer-base';
import Cart from '@/core/cart-manager';

export default class ClearCartRenderer extends Renderer {
	constructor(cart: Cart, container: HTMLElement) {
		super(cart, container);
	}

	render(): void {
		this.container.addEventListener('click', (e) => {
			e.preventDefault();
			this.cart.clear();
		});
	}
}
