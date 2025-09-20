import { Renderer } from '@/cart/renderer-base';
import { subscribeEvent } from '@/utils/events';
import Cart from '@/core/cart-manager';
import { logger } from '@/utils/error';

export default class CartDrawerRenderer extends Renderer {
	private drawerElement: HTMLElement | null = null;
	private activeClass: string = 'bf-open';

	constructor(
		cart: Cart,
		container: HTMLElement,
		private type: 'open' | 'close' = 'open',
	) {
		super(cart, container);
		this.drawerElement = document.querySelector('[data-bf-cart-drawer]') as HTMLElement | null;
		if (this.drawerElement) {
			this.activeClass = this.drawerElement.dataset.bfCartDrawerActiveClass ?? 'bf-open';
		}

		this.setupEventListeners(type);
	}

	private setupEventListeners(type: 'open' | 'close'): void {
		subscribeEvent('cart:add:completed', (details) => {
			if (type === 'open') {
				this.open();
			}
		});
	}

	render(): void {
		this.container.addEventListener('click', (e) => {
			e.preventDefault();
			if (this.type === 'open') {
				this.open();
			} else {
				this.close();
			}
		});
	}

	private open(): void {
		if (!this.drawerElement) {
			logger.error('Cart drawer element not found.');
			return;
		}

		this.drawerElement.classList.add(this.activeClass);
		this.drawerElement.setAttribute('aria-hidden', 'false');
	}

	private close(): void {
		if (!this.drawerElement) {
			logger.error('Cart drawer element not found.');
			return;
		}
		this.drawerElement.classList.remove(this.activeClass);
		this.drawerElement.setAttribute('aria-hidden', 'true');
	}
}
