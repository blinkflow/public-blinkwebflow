export const mapProductIdToGid = (id: string) =>
	id.startsWith('gid://shopify/Product/') ? id : `gid://shopify/Product/${id}`;

export const mapGidToProductId = (gid: string) => {
	return gid.startsWith('gid://shopify/Product/') ? gid.split('/').pop() ?? '' : gid;
};


export const mapVariantIdToGid = (id: string) =>
	id.startsWith('gid://shopify/ProductVariant/') ? id : `gid://shopify/ProductVariant/${id}`;

export const mapGidToVariantId = (gid: string) => {
	return gid.startsWith('gid://shopify/ProductVariant/') ? gid.split('/').pop() ?? '' : gid;
};