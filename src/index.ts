import bootstrapProducts from '@/products/bootstrap';
import GlobalBlink from '@/core/global-blink';
import { logger } from '@/utils/error';

declare global {
	interface Window {
		Blink: GlobalBlink;
	}
}

export {};

document.addEventListener('DOMContentLoaded', async () => {
	if (!window.Blink) {
		window.Blink = new GlobalBlink();
	}

	try {
		await window.Blink.ready;
		bootstrapProducts(window.Blink);
	} catch (err) {
		logger.error('Failed to initialize GlobalBlink or products', err);
	}
});
