import { Renderer } from '@/cart/renderer-base';
import { subscribeEvent } from '@/utils/events';
import Cart from '@/core/cart-manager';

export default class CartTotalRenderer extends Renderer {
	constructor(
		cart: Cart,
		container: HTMLElement,
		private type: 'subtotal' | 'total' = 'total',
	) {
		super(cart, container);
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		subscribeEvent('cart:refresh:completed', () => {
			this.render();
		});
	}

	render(): void {
		switch (this.type) {
			case 'subtotal':
				this.container.textContent = this.cart.subtotalFormatted;
				break;
			case 'total':
				this.container.textContent = this.cart.totalFormatted;
				break;
			default:
				this.container.textContent = this.cart.totalFormatted;
				break;
		}
	}
}
