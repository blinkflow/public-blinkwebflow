import CartRenderer from '@/cart/cart-renderer';
import GlobalBlink from '@/core/global-blink';

export default function bootstrapCart(globalBlink: GlobalBlink) {
	const cartElements = document.querySelectorAll<HTMLElement>('[data-bf-cart]');

	cartElements.forEach((el) => {
		const renderer = new CartRenderer(globalBlink.cart, el, globalBlink.store.moneyFormat ?? '${{amount}}');
		renderer.render();

		(el as any)._cart = globalBlink.cart;
		(el as any)._cartRenderer = renderer;
	});
}
