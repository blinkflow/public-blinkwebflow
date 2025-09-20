import Cart from '@/core/cart-manager';

export abstract class Renderer {
	constructor(
		protected cart: Cart,
		protected container: HTMLElement,
	) {}

	abstract render(): void;
}
