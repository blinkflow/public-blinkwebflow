import Product from "@/products/product";

export abstract class Renderer {
	protected constructor(
		protected product: Product,
		protected container: HTMLElement,
	) {}

	/**
	 * Render the component in the DOM.
	 * Must be implemented by subclasses.
	 */
	abstract render(): void;
}