import { ShopifyClient } from '@/utils/shopify-client';
import { publishEvent } from '@/utils/events';
import { logger } from '@/utils/error';
import { Cache } from '@/utils/cache';

const CART_CREATE_MUTATION = `
	mutation cartCreate($input: CartInput!) {
			cartCreate(input: $input) {
				cart {
					id
			}
			userErrors {
					field
					message
			}
			}
	}
`;

const CART_QUERY = `
	query getCart($cartId: ID!) {
	cart(id: $cartId) {
			id
			checkoutUrl
			createdAt
			updatedAt
			totalQuantity

			lines(first: 50) {
			edges {
					node {
					id
					quantity
					attributes {
							key
							value
					}
					cost {
							amountPerQuantity {
							amount
							currencyCode
							}
							totalAmount {
							amount
							currencyCode
							}
					}
					merchandise {
							... on ProductVariant {
							id
							title
							sku
							availableForSale
							quantityAvailable
							image {
									url
									altText
							}
							price {
									amount
									currencyCode
							}
							product {
									id
									title
									handle
									vendor
									featuredImage {
									url
									altText
									}
							}
							}
					}
					sellingPlanAllocation {
							sellingPlan {
							id
							name
							options {
									name
									value
							}
							}
					}
					}
			}
			}

			estimatedCost {
			subtotalAmount {
					amount
					currencyCode
			}
			totalAmount {
					amount
					currencyCode
			}
			totalTaxAmount {
					amount
					currencyCode
			}
			}
	}
	}
`;

const CART_LINES_ADD_MUTATION = `
	mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
			cartLinesAdd(cartId: $cartId, lines: $lines) {
			cart {
					id
			}
			userErrors {
					field
					message
			}
			}
	}
`;

const CART_LINES_REMOVE_MUTATION = `
	mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
			cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
					cart { id }
					userErrors { field message }
			}
	}
`;

const CART_LINES_UPDATE_MUTATION = `
	mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
		cartLinesUpdate(cartId: $cartId, lines: $lines) {
			cart { id }
			userErrors { field message }
		}
	}
`;

interface CartLine {
	id: string;
	quantity: number;
	attributes: Array<{ key: string; value: string }>;
	cost: {
		amountPerQuantity: { amount: string; currencyCode: string };
		totalAmount: { amount: string; currencyCode: string };
	};
	merchandise: {
		id: string;
		title: string;
		sku: string;
		availableForSale: boolean;
		quantityAvailable: number;
		image: { url: string; altText: string };
		price: { amount: string; currencyCode: string };
		product: {
			id: string;
			title: string;
			handle: string;
			vendor: string;
			featuredImage: { url: string; altText: string };
		};
	};
}

interface CartData {
	id: string;
	checkoutUrl: string;
	createdAt: string;
	updatedAt: string;
	totalQuantity: number;
	lines: {
		edges: Array<{ node: CartLine }>;
	};
	estimatedCost: {
		subtotalAmount: { amount: string; currencyCode: string };
		totalAmount: { amount: string; currencyCode: string };
		totalTaxAmount: { amount: string; currencyCode: string };
	};
}

export default class Cart {
	private cart!: CartData;

	constructor(
		private shopifyClient: ShopifyClient,
		private cacheKey: string,
		private cacheTTL: number,
	) {}

	async init() {
		publishEvent('cart:init:started', { cacheKey: this.cacheKey });
		const cachedCart = Cache.get<CartData>(this.cacheKey);
		if (cachedCart) {
			this.cart = cachedCart;
			logger.info('Cart loaded from localStorage:', this.cart);
			publishEvent('cart:init:loaded', { cart: this.cart, source: 'cache' });
		} else {
			publishEvent('cart:init:empty', { source: 'no-cache' });
		}

		publishEvent('cart:init:completed', { hasCart: !!this.cart });
	}

	get isEmpty(): boolean {
		return !this.cart || !this.cart.lines?.edges?.length;
	}

	get itemCount(): number {
		return this.cart?.totalQuantity || 0;
	}

	get subtotal(): string {
		return this.cart?.estimatedCost?.subtotalAmount?.amount || '0';
	}

	get total(): string {
		return this.cart?.estimatedCost?.totalAmount?.amount || '0';
	}

	getLineItem(lineId: string): CartLine | null {
		if (!this.cart?.lines?.edges) return null;
		const edge = this.cart.lines.edges.find((edge) => edge.node.id === lineId);
		return edge?.node || null;
	}

	hasVariant(variantId: string): boolean {
		if (!this.cart?.lines?.edges) return false;
		return this.cart.lines.edges.some((edge) => edge.node.merchandise.id === variantId);
	}

	private async create(variantId: string, quantity: number) {
		publishEvent('cart:create:started', { variantId, quantity });
		const variables = {
			input: {
				lines: [
					{
						quantity,
						merchandiseId: variantId,
					},
				],
			},
		};
		try {
			const response = await this.shopifyClient.executeQuery(CART_CREATE_MUTATION, variables);
			if (response.userErrors && response.userErrors.length > 0) {
				throw logger.error('Shopify user errors:', response.userErrors);
			}

			publishEvent('cart:create:completed', { cartId: response.data.cartCreate.cart.id, variantId, quantity });
			return response.data.cartCreate.cart;
		} catch (err) {
			publishEvent('cart:create:error', { variantId, quantity, error: err });
			throw err;
		}
	}

	private async addToExisting(variantId: string, quantity: number) {
		publishEvent('cart:addToExisting:started', { variantId, quantity, cartId: this.cart.id });
		const variables = {
			cartId: this.cart.id,
			lines: [{ quantity, merchandiseId: variantId }],
		};
		try {
			const res = await this.shopifyClient.executeQuery(CART_LINES_ADD_MUTATION, variables);
			if (res.data.cartLinesAdd.userErrors && res.data.cartLinesAdd.userErrors.length > 0) {
				throw logger.error('Shopify user errors:', res.data.cartLinesAdd.userErrors);
			}

			publishEvent('cart:addToExisting:completed', { variantId, quantity, cartId: this.cart.id });
			return res.data.cartLinesAdd.cart;
		} catch (err) {
			publishEvent('cart:addToExisting:error', { variantId, quantity, error: err });
			logger.error('Error adding to existing cart:', err);
			throw err;
		}
	}

	private async fetch(cartId: string) {
		publishEvent('cart:fetch:started', { cartId });
		const variables = { cartId };
		try {
			const res = await this.shopifyClient.executeQuery(CART_QUERY, variables);
			if (res.errors) {
				throw logger.error('Shopify errors:', res.errors);
			}
			publishEvent('cart:fetch:completed', { cartId, cart: res.data.cart });
			return res.data.cart;
		} catch (err) {
			publishEvent('cart:fetch:error', { cartId, error: err });
			logger.error('Error fetching cart:', err);
			return null;
		}
	}

	private handleShopifyErrors(userErrors: any[], operation: string): void {
		if (userErrors && userErrors.length > 0) {
			const errorMessage = userErrors.map((e) => e.message).join(', ');
			throw logger.error(`${operation} failed: ${errorMessage}`, userErrors);
		}
	}

	async clear() {
		if (!(this.cart && this.cart.lines && this.cart.lines.edges.length > 0)) {
			logger.error('No cart to clear');
			return;
		}

		const lineIds = this.cart.lines.edges.map((edge: any) => edge.node.id);
		if (lineIds.length > 0) {
			const variables = { cartId: this.cart.id, lineIds };
			publishEvent('cart:clear:started', { lineIds });
			try {
				const response = await this.shopifyClient.executeQuery(CART_LINES_REMOVE_MUTATION, variables);
				this.handleShopifyErrors(response.data?.cartLinesRemove?.userErrors, 'Clear cart');
				publishEvent('cart:clear:completed', { lineIds });
			} catch (err) {
				logger.error('Error clearing cart:', err);
				publishEvent('cart:clear:error', { error: err });
			}
		}

		await this.refresh();
	}

	async removeLineItem(lineId: string) {
		if (!this.cart) {
			throw logger.error('No cart to remove item from');
		}
		publishEvent('cart:removeLineItem:started', { lineId });
		try {
			const variables = { cartId: this.cart.id, lineIds: [lineId] };
			const response = await this.shopifyClient.executeQuery(CART_LINES_REMOVE_MUTATION, variables);
			this.handleShopifyErrors(response.data?.cartLinesRemove?.userErrors, 'Remove line item');

			publishEvent('cart:removeLineItem:completed', { lineId });
		} catch (err) {
			publishEvent('cart:removeLineItem:error', { lineId, error: err });
			logger.error('Error removing line item:', err);
		}

		await this.refresh();
	}

	async refresh() {
		publishEvent('cart:refresh:started', { cartId: this.cart.id });
		try {
			this.cart = await this.fetch(this.cart.id);
			Cache.set(this.cacheKey, this.cart, this.cacheTTL);
			publishEvent('cart:refresh:completed', { cart: this.cart });
		} catch (err) {
			publishEvent('cart:refresh:error', { cartId: this.cart.id, error: err });
			throw err;
		}
	}

	async add({ variantId, quantity = 1 }: { variantId: string; quantity?: number }) {
		publishEvent('cart:add:started', { variantId, quantity });

		try {
			if (!this.cart) {
				this.cart = await this.create(variantId, quantity);
			} else {
				await this.addToExisting(variantId, quantity);
				await this.refresh();
			}
		} catch (error) {
			publishEvent('cart:add:error', { variantId, quantity, error });
			throw error;
		}
		publishEvent('cart:add:completed', { cart: this.cart, variantId, quantity });
	}

	async updateLineItemQuantity(lineId: string, quantity: number): Promise<void> {
		if (!this.cart) {
			throw logger.error('No cart to update item in');
		}

		if (quantity <= 0) {
			return this.removeLineItem(lineId);
		}

		publishEvent('cart:updateQuantity:started', { lineId, quantity });

		try {
			const variables = {
				cartId: this.cart.id,
				lines: [{ id: lineId, quantity }],
			};

			const response = await this.shopifyClient.executeQuery(CART_LINES_UPDATE_MUTATION, variables);

			this.handleShopifyErrors(response.data?.cartLinesUpdate?.userErrors, 'Update quantity');

			await this.refresh();
			publishEvent('cart:updateQuantity:completed', { lineId, quantity });
		} catch (error) {
			publishEvent('cart:updateQuantity:error', { lineId, quantity, error });
			throw error;
		}
	}
}
