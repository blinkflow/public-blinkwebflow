import { formatCurrency } from '@/utils/currency';
import { Renderer } from '@/cart/renderer-base';
import { subscribeEvent } from '@/utils/events';
import Cart from '@/core/cart-manager';
import { logger } from '@/utils/error';

export default class LineItemRenderer extends Renderer {
	private template: HTMLElement | null = null;
	private renderedItems: Map<string, HTMLElement> = new Map();

	constructor(
		cart: Cart,
		container: HTMLElement,
		private moneyFormat: string,
	) {
		super(cart, container);
		this.setupEventListeners();
		this.createTemplate();
	}

	private setupEventListeners(): void {
		subscribeEvent('cart:refresh:completed', () => {
			this.render();
		});
	}

	private createTemplate(): void {
		const temp = this.container.querySelector('[data-bf-line-item]') as HTMLElement | null;
		if (temp) {
			this.template = temp.cloneNode(true) as HTMLElement;
			temp.style.display = 'none';
		}
	}

	render(): void {
		if (!this.template) {
			logger.error('Line item template element not found.');
			return;
		}

		const cartData = this.cart.cartData;
		if (!cartData || this.cart.itemCount <= 0) {
			this.renderedItems.forEach((element) => {
				element.remove();
			});
			this.renderedItems.clear();
			logger.info('Cart is empty or cart data is unavailable.');
			return;
		}

		const currentLineIds = new Set<string>();

		cartData.lines.edges.forEach((edge) => {
			const line = edge.node;
			const lineId = line.id;
			currentLineIds.add(lineId);

			let itemEl = this.renderedItems.get(lineId);

			if (!itemEl) {
				itemEl = this.template!.cloneNode(true) as HTMLElement;
				this.container.appendChild(itemEl);
				itemEl.style.display = '';
				this.renderedItems.set(lineId, itemEl);

				const img = itemEl.querySelector('[data-bf-line-image]') as HTMLImageElement;
				if (img && line.merchandise.image) {
					img.src = line.merchandise.image.url;
					img.alt = line.merchandise.image.altText || '';
				}

				const titleEl = itemEl.querySelector('[data-bf-line-title]');
				if (titleEl) titleEl.textContent = line.merchandise.product.title;

				const optionEl = itemEl.querySelector('[data-bf-line-selected-option]');
				if (optionEl) optionEl.textContent = line.merchandise.title;

				const removeBtn = itemEl.querySelector('[data-bf-remove-line-item]') as HTMLButtonElement;
				if (removeBtn) {
					removeBtn.onclick = async (e) => {
						e.preventDefault();
						await this.cart.removeLineItem(line.id);
					};
				}
			}

			const qtyEl = itemEl.querySelector('[data-bf-line-qty]');
			if (qtyEl) qtyEl.textContent = line.quantity.toString();

			const perQtyEl = itemEl.querySelector('[data-bf-line-amount-per-qty]');
			if (perQtyEl && line.cost?.amountPerQuantity) {
				perQtyEl.textContent = formatCurrency(
					line.cost.amountPerQuantity.amount,
					line.cost.amountPerQuantity.currencyCode,
					this.moneyFormat,
				);
			}

			const totalEl = itemEl.querySelector('[data-bf-line-total-amount]');
			if (totalEl && line.cost?.totalAmount) {
				totalEl.textContent = formatCurrency(
					line.cost.totalAmount.amount,
					line.cost.totalAmount.currencyCode,
					this.moneyFormat,
				);
			}
		});

		this.renderedItems.forEach((element, lineId) => {
			if (!currentLineIds.has(lineId)) {
				element.remove();
				this.renderedItems.delete(lineId);
			}
		});
	}
}
