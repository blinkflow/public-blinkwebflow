import { Renderer } from '@/cart/renderer-base';
import { subscribeEvent } from '@/utils/events';
import Cart from '@/core/cart-manager';

export default class CartCountRenderer extends Renderer {
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
		if (this.cart.itemCount <= 0) {
			this.container.style.display = 'none';
			return;
		}

		this.container.style.display = '';
		this.container.textContent = `(${this.cart.itemCount.toString()})`;
	}
}
