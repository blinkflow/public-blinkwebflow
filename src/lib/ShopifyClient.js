/**
 * Handles communication with the Shopify Storefront API.
 */
export class ShopifyClient {
    /**
     * @param {object} params
     * @param {string} params.token - Storefront access token.
     * @param {string} params.storeDomain - Shopify store domain.
     */
    constructor({ token, storeDomain }) {
        this.token = token;
        this.storeDomain = storeDomain;
    }

    /**
     * Executes a GraphQL query against the Shopify Storefront API.
     * @param {string} query - GraphQL query string.
     * @param {object} [variables={}] - Query variables.
     * @returns {Promise<object>} The API response.
     */
    async executeQuery(query, variables = {}) {
        if (!this.token || !this.storeDomain) {
            console.error("[Blink] Shopify instance is not initialized.");
            return;
        }
        const url = `https://${this.storeDomain}/api/2025-04/graphql.json`;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Storefront-Access-Token": this.token,
                },
                body: JSON.stringify({ query, variables }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error("Shopify API Error:", errorData);
                throw new Error(`Shopify GraphQL error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Shopify API Error:", error.message);
            throw error;
        }
    }
}
