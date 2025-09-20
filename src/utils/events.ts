type EventDetail = Record<string, any>;

export function publishEvent(eventName: string, detail?: EventDetail) {
	const event = new CustomEvent('blink:' + eventName, { detail });
	document.dispatchEvent(event);
}

export function subscribeEvent(eventName: string, callback: (detail?: EventDetail) => void) {
	const handler = (e: Event) => {
		const customEvent = e as CustomEvent;
		callback(customEvent.detail);
	};
	document.addEventListener('blink:' + eventName, handler);
	return () => document.removeEventListener('blink:' + eventName, handler);
}
