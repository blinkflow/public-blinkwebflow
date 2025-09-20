import { Renderer } from '@/cart/renderer-base';
import { subscribeEvent } from '@/utils/events';
import Cart from '@/core/cart-manager';

export default class EmptyCartRenderer extends Renderer {
	constructor(cart: Cart, container: HTMLElement) {
		super(cart, container);
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		subscribeEvent('cart:refresh:completed', () => {
			this.render();
		});
	}

	render(): void {
		const cartData = this.cart.itemCount;
		const isEmpty = cartData <= 0;

		this.container.style.display = isEmpty ? '' : 'none';
	}
}
