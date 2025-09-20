import CompareAtPriceRenderer from '@/products/renderers/compare-at-price';
import ProductOptionsRenderer from '@/products/renderers/product-options';
import DescriptionRenderer from '@/products/renderers/description';
import AddToCartRenderer from '@/products/renderers/add-to-cart';
import GalleryRenderer from '@/products/renderers/gallery';
import TitleRenderer from '@/products/renderers/title';
import PriceRenderer from '@/products/renderers/price';
import { Renderer } from './renderer-base';
import Product from '@/products/product';

function selectScopedElements<T extends HTMLElement>(container: HTMLElement, selector: string): T[] {
	return Array.from(container.querySelectorAll<T>(selector)).filter(
		(el) => el.closest('[data-bf-product-id]') === container,
	);
}

('');
export default class ProductRenderer {
	private renderers: Renderer[] = []; // could be typed better for all sub-renderer types

	constructor(
		private product: Product,
		private container: HTMLElement,
		private moneyFormat: string,
	) {
		container.style.opacity = '0';
		// Titles
		selectScopedElements<HTMLElement>(container, '[data-bf-product-title]').forEach((el) => {
			this.renderers.push(new TitleRenderer(product, el));
		});

		// Descriptions
		selectScopedElements<HTMLElement>(container, '[data-bf-product-description]').forEach((el) => {
			this.renderers.push(new DescriptionRenderer(product, el));
		});

		// Prices
		selectScopedElements<HTMLElement>(container, '[data-bf-product-price]').forEach((el) => {
			this.renderers.push(new PriceRenderer(product, el, moneyFormat));
		});

		// Compare-at prices
		selectScopedElements<HTMLElement>(container, '[data-bf-product-compare-at-price]').forEach((el) => {
			this.renderers.push(new CompareAtPriceRenderer(product, el, moneyFormat));
		});

		// Product options
		selectScopedElements<HTMLElement>(container, '[data-bf-product-option]').forEach((el) => {
			this.renderers.push(new ProductOptionsRenderer(product, el));
		});

		// Add-to-cart buttons
		selectScopedElements<HTMLButtonElement>(container, '[data-bf-add-to-cart]').forEach((el) => {
			this.renderers.push(new AddToCartRenderer(product, el));
		});

		// Galleries
		selectScopedElements<HTMLElement>(container, '[data-bf-product-gallery]').forEach((el) => {
			this.renderers.push(new GalleryRenderer(product, el));
		});
	}

	render() {
		this.renderers.forEach((renderer) => renderer.render());
		this.container.style.opacity = '1';
	}
}
