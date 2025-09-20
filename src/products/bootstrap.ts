import ProductRenderer from '@/products/product-renderer';
import GlobalBlink from '@/core/global-blink';
import Product from '@/products/product';

export default function bootstrapProducts(globalBlink: GlobalBlink) {
	const productElements = document.querySelectorAll<HTMLElement>('[data-bf-product-id]');

	productElements.forEach((el) => {
		const productId = el.dataset.bfProductId;
		if (!productId || productId == '{{ Connect Your Shopify Product ID }}') return;

		const product = new Product(productId, globalBlink);

		const renderer = new ProductRenderer(product, el, globalBlink.store.moneyFormat ?? '${{amount}}');
		renderer.render();

		(el as any)._product = product;
		(el as any)._productRenderer = renderer;
	});
}
