export default function isSingleProductPage() {
	const pathname = window.location.pathname;

	// Check if path matches /products/[slug] pattern
	const productPagePattern = /^\/products\/[^\/]+\/?$/;
	return productPagePattern.test(pathname);
}
