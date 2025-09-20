import { Renderer } from '@/cart/renderer-base';
import Cart from '@/core/cart-manager';
import { logger } from '@/utils/error';

export default class CheckoutButtonRenderer extends Renderer {
	constructor(cart: Cart, container: HTMLElement) {
		super(cart, container);
	}

	render(): void {
		this.container.addEventListener('click', (e) => {
			e.preventDefault();
			if (this.cart.cartData && this.cart.cartData.checkoutUrl) {
				window.location.href = this.cart.cartData.checkoutUrl;
			} else {
				logger.error('Checkout URL is not available.');
			}
		});
	}
}
