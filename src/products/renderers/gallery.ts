import { Renderer } from '@/products/renderer-base';
import { subscribeEvent } from '@/utils/events';
import Product from '@/products/product';
import { logger } from '@/utils/error';

export default class GalleryRenderer extends Renderer {
	private currentIndex: number = 0;
	private readonly sliderElement: HTMLElement;
	private readonly thumbnailsWrapper: HTMLElement | null;
	private readonly nextButton: HTMLElement | null;
	private readonly prevButton: HTMLElement | null;
	private readonly activeImageTemplate: HTMLElement | null = null;
	private readonly thumbnailTemplate: HTMLElement | null = null;
	private thumbnails: HTMLElement[] = [];
	private imageElements: HTMLElement[] = [];

	constructor(product: Product, container: HTMLElement) {
		super(product, container);
		this.sliderElement = this.getSliderElement();
		this.thumbnailsWrapper = this.getThumbnailsWrapper();

		this.nextButton = this.container.querySelector('[data-bf-image-slider-arrow-right]');
		this.prevButton = this.container.querySelector('[data-bf-image-slider-arrow-left]');

		this.activeImageTemplate = this.createTemplateElement();
		this.thumbnailTemplate = this.createThumbnailTemplate();

		if (!this.activeImageTemplate) {
			return;
		}

		this.setupEventListeners();
	}

	private getSliderElement(): HTMLElement {
		const slider = this.container.querySelector('[data-bf-product-image-slider]');
		if (!slider) {
			throw logger.error('Slider element not found');
		}
		return slider as HTMLElement;
	}

	private getThumbnailsWrapper(): HTMLElement | null {
		const wrapper = this.container.querySelector('[data-bf-thumbnail-wrapper]');
		if (!wrapper) {
			logger.info('Thumbnails wrapper element not found');
			return null;
		}
		return wrapper as HTMLElement;
	}

	private createTemplateElement(): HTMLElement | null {
		const temp = this.sliderElement.querySelector('[data-bf-product-image]') as HTMLElement | null;

		if (!temp) {
			logger.error(
				'No product image template found. Please add an element with the attribute "data-bf-product-image" inside the slider container.',
			);
			return null;
		}

		temp.style.display = 'none';

		return temp.cloneNode(true) as HTMLElement;
	}

	private createThumbnailTemplate(): HTMLElement | null {
		if (!this.thumbnailsWrapper) {
			return null;
		}

		const temp = this.thumbnailsWrapper.querySelector('[data-bf-thumbnail-image]') as HTMLElement | null;
		if (!temp) {
			logger.info('No thumbnail template found. Thumbnails will not be rendered.');
			return null;
		}

		return temp.cloneNode(true) as HTMLElement;
	}

	private setupEventListeners(): void {
		subscribeEvent('product:variant-change', (detail) => {
			if (detail?.productId === this.product.id) {
				this.handleVariantChange();
			}
		});
	}

	private handleVariantChange(): void {
		const selectedImageId = this.product.selectedVariant.image?.id;
		if (!selectedImageId) return;

		const imageIndex = this.product.details.images.edges.findIndex((edge) => edge.node.id === selectedImageId);

		if (imageIndex !== -1) {
			this.updateActiveImage(imageIndex);
		}
	}

	render(): void {
		const images = this.product.details.images.edges.map((edge) => edge.node);
		if (images.length === 0) {
			this.container.style.display = 'none';
			return;
		}

		this.container.style.display = '';
		this.renderSlider(images);
		this.renderThumbnails(images);
		this.handleVariantChange();
		this.setupNavigationButtons(images.length);
	}

	private setupNavigationButtons(imageCount: number): void {
		if (this.nextButton) {
			this.nextButton.style.display = imageCount > 1 ? '' : 'none';
			this.nextButton.onclick = (e) => {
				e.preventDefault();
				const newIndex = (this.currentIndex + 1) % imageCount;
				this.updateActiveImage(newIndex);
			};
		}

		if (this.prevButton) {
			this.prevButton.style.display = imageCount > 1 ? '' : 'none';
			this.prevButton.onclick = (e) => {
				e.preventDefault();
				const newIndex = (this.currentIndex - 1 + imageCount) % imageCount;
				this.updateActiveImage(newIndex);
			};
		}
	}

	private renderSlider(images: Array<{ id: string; src: string; altText: string | null }>): void {
		if (!this.activeImageTemplate) {
			return;
		}

		this.sliderElement.querySelectorAll('[data-bf-product-image]').forEach((el) => {
			el.remove();
		});

		this.imageElements = images.map((image, index) => {
			const imageElement = this.activeImageTemplate!.cloneNode(true) as HTMLElement;

			let imgTag =
				imageElement.tagName == 'IMG' ? (imageElement as HTMLImageElement) : imageElement.querySelector('img');

			if (!imgTag) {
				imgTag = document.createElement('img');
				imageElement.appendChild(imgTag);
			}

			imgTag.src = image.src;
			imgTag.alt = image.altText || `Product Image ${index + 1}`;

			if (this.currentIndex === index) {
				imageElement.style.display = '';
			}

			imageElement.setAttribute('data-image-id', image.id);
			this.sliderElement.appendChild(imageElement);
			return imageElement;
		});
	}

	private renderThumbnails(images: Array<{ id: string; src: string; altText: string | null }>): void {
		if (!this.thumbnailsWrapper) {
			return;
		}

		if (!this.thumbnailTemplate) {
			this.thumbnailsWrapper.style.display = 'none';
			return;
		}

		this.thumbnailsWrapper.querySelectorAll('[data-bf-thumbnail-image],[role="listitem"]').forEach((el) => {
			el.remove();
		});
		this.thumbnails = images.map((thumb, index) => {
			const imageElement = this.thumbnailTemplate!.cloneNode(true) as HTMLElement;

			let imgTag =
				imageElement.tagName == 'IMG' ? (imageElement as HTMLImageElement) : imageElement.querySelector('img');

			if (!imgTag) {
				imgTag = document.createElement('img');
				imageElement.appendChild(imgTag);
			}

			imgTag.src = thumb.src;
			imgTag.alt = thumb.altText || `Thumbnail ${index + 1}`;

			if (this.currentIndex === index) {
				imageElement.classList.add('bf-active');
			}

			imageElement.setAttribute('data-image-id', thumb.id);
			this.thumbnailsWrapper!.appendChild(imageElement);

			imageElement.addEventListener('click', () => {
				this.updateActiveImage(index);
			});

			return imageElement;
		});
	}

	private updateActiveImage(index: number): void {
		if (index < 0 || index >= this.imageElements.length) {
			return;
		}

		this.imageElements.forEach((imgEl, idx) => {
			imgEl.style.display = idx === index ? '' : 'none';
		});

		this.thumbnails.forEach((thumbEl, idx) => {
			if (idx === index) {
				thumbEl.classList.add('bf-active');
			} else {
				thumbEl.classList.remove('bf-active');
			}
		});

		this.currentIndex = index;
	}
}
