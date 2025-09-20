interface Price {
	amount: string;
	currencyCode: string;
}

interface PriceRange {
	minVariantPrice: Price;
	maxVariantPrice: Price;
}

interface ProductImage {
	src: string;
	altText: string;
	id: string;
	width: number;
	height: number;
}

interface ProductImageEdge {
	node: ProductImage;
}

interface SwatchImage {
	id: string;
	alt: string;
	previewImage: {
		altText: string;
		url: string;
	};
}

interface OptionValueSwatch {
	color?: string;
	image?: SwatchImage;
}

export interface OptionValue {
	id: string;
	name: string;
	swatch?: OptionValueSwatch;
}

export interface ProductOption {
	name: string;
	optionValues: OptionValue[];
}

interface Metafield {
	id: string;
	namespace: string;
	key: string;
	value: string;
	reference?: {
		__typename: string;
		alt?: string;
		image?: { url: string };
	};
	type: string;
	description?: string;
}

interface Collection {
	id: string;
	title: string;
	metafields: Metafield[];
	handle: string;
	description: string;
	descriptionHtml: string;
	image?: { src: string };
}

interface CollectionEdge {
	node: Collection;
}

interface SelectedOption {
	name: string;
	value: string;
}

interface SellingPlanOption {
	name: string;
	value: string;
}

interface CheckoutCharge {
	type: string;
	value: string;
}

interface SellingPlan {
	id: string;
	name: string;
	description: string;
	checkoutCharge: CheckoutCharge;
	recurringDeliveries: boolean;
	options: SellingPlanOption[];
}

interface PriceAdjustment {
	price: Price;
	compareAtPrice: Price;
	perDeliveryPrice: Price;
	unitPrice: Price;
}

interface SellingPlanAllocation {
	sellingPlan: SellingPlan;
	priceAdjustments: PriceAdjustment[];
}

interface SellingPlanAllocationEdge {
	node: SellingPlanAllocation;
}

interface ProductVariant {
	id: string;
	product: {
		id: string;
		title: string;
		vendor: string;
	};
	title: string;
	sku: string;
	barcode: string;
	price: Price;
	unitPrice: Price;
	compareAtPrice: Price;
	image?: ProductImage;
	selectedOptions: SelectedOption[];
	availableForSale: boolean;
	currentlyNotInStock: boolean;
	quantityAvailable: number;
	metafields: Metafield[];
	weight: number;
	weightUnit: string;
	sellingPlanAllocations: {
		edges: SellingPlanAllocationEdge[];
	};
}

interface ProductVariantEdge {
	node: ProductVariant;
}

interface SellingPlanPriceAdjustment {
	orderCount: number;
	adjustmentValue: {
		__typename: string;
		adjustmentPercentage?: number;
		adjustmentAmount?: Price;
		price?: Price;
	};
}

interface SellingPlanGroupPlan {
	id: string;
	name: string;
	description: string;
	recurringDeliveries: boolean;
	options: SellingPlanOption[];
	priceAdjustments: SellingPlanPriceAdjustment[];
}

interface SellingPlanGroupPlanEdge {
	node: SellingPlanGroupPlan;
}

interface SellingPlanGroup {
	appName: string;
	name: string;
	sellingPlans: {
		edges: SellingPlanGroupPlanEdge[];
	};
}

interface SellingPlanGroupEdge {
	node: SellingPlanGroup;
}

export interface ShopifyProduct {
	id: string;
	title: string;
	handle: string;
	description: string;
	descriptionHtml: string;
	priceRange: PriceRange;
	compareAtPriceRange: PriceRange;
	options: ProductOption[];
	images: {
		edges: ProductImageEdge[];
	};
	collections: {
		edges: CollectionEdge[];
	};
	vendor: string;
	productType: string;
	tags: string[];
	requiresSellingPlan: boolean;
	variants: {
		edges: ProductVariantEdge[];
	};
	sellingPlanGroups: {
		edges: SellingPlanGroupEdge[];
	};
}

export interface ProductQueryResponse {
	data: {
		node: ShopifyProduct | null;
	};
	errors?: Array<{
		message: string;
		locations?: Array<{
			line: number;
			column: number;
		}>;
		path?: string[];
	}>;
}
