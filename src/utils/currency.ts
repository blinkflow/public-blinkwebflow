export function formatCurrency(amount: number | string, currency: string, moneyFormat = '{{amount}}{{currency_code}}') {
	let formatted = moneyFormat || '${{amount}}';
	formatted = formatted.replace('{{amount}}', parseFloat(`${amount}`).toFixed(2));
	formatted = formatted.replace('{{currency_code}}', currency || '');
	return formatted;
}
