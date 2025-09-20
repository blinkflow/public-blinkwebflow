import CheckoutButtonRenderer from '@/cart/renderers/checkout-button';
import CartDrawerRenderer from '@/cart/renderers/cart-drawer';
import EmptyCartRenderer from '@/cart/renderers/empty-cart';
import ClearCartRenderer from '@/cart/renderers/clear-cart';
import CartTotalRenderer from '@/cart/renderers/cart-total';
import CartCountRenderer from '@/cart/renderers/cart-count';
import LineItemRenderer from '@/cart/renderers/line-item';
import { Renderer } from './renderer-base';
import Cart from '@/core/cart-manager';

function selectScopedElements<T extends HTMLElement>(container: HTMLElement, selector: string): T[] {
	return Array.from(container.querySelectorAll<T>(selector)).filter((el) => el.closest('[data-bf-cart]') === container);
}

export default class CartRenderer {
	private renderers: Renderer[] = [];

	constructor(
		private cart: Cart,
		private container: HTMLElement,
		private moneyFormat: string,
	) {
		// Cart items count
		selectScopedElements<HTMLElement>(container, '[data-bf-cart-items-count]').forEach((el) => {
			this.renderers.push(new CartCountRenderer(cart, el));
		});

		// Line items container
		selectScopedElements<HTMLElement>(container, '[data-bf-line-items]').forEach((el) => {
			this.renderers.push(new LineItemRenderer(cart, el, moneyFormat));
		});

		// Cart subtotal
		selectScopedElements<HTMLElement>(container, '[data-bf-cart-subtotal]').forEach((el) => {
			this.renderers.push(new CartTotalRenderer(cart, el, 'subtotal'));
		});

		// Cart total
		selectScopedElements<HTMLElement>(container, '[data-bf-cart-total]').forEach((el) => {
			this.renderers.push(new CartTotalRenderer(cart, el, 'total'));
		});

		// Empty cart message
		selectScopedElements<HTMLElement>(container, '[data-bf-empty-cart-message]').forEach((el) => {
			this.renderers.push(new EmptyCartRenderer(cart, el));
		});

		// Checkout buttons
		selectScopedElements<HTMLElement>(container, '[data-bf-checkout]').forEach((el) => {
			this.renderers.push(new CheckoutButtonRenderer(cart, el));
		});

		// Clear cart buttons
		selectScopedElements<HTMLElement>(container, '[data-bf-clear-cart]').forEach((el) => {
			this.renderers.push(new ClearCartRenderer(cart, el));
		});

		// Cart drawer controls
		this.renderers.push(
			...Array.from(document.querySelectorAll<HTMLElement>('[data-bf-cart-drawer-open]')).map(
				(el) => new CartDrawerRenderer(cart, el, 'open'),
			),
		);

		this.renderers.push(
			...Array.from(document.querySelectorAll<HTMLElement>('[data-bf-cart-drawer-close]')).map(
				(el) => new CartDrawerRenderer(cart, el, 'close'),
			),
		);
	}

	render() {
		this.renderers.forEach((renderer) => renderer.render());
	}
}
