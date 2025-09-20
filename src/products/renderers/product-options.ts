import { OptionValue, ProductOption } from '@/types/products';
import { publishEvent, subscribeEvent } from '@/utils/events';
import { Renderer } from '@/products/renderer-base';
import Product from '@/products/product';
import { logger } from '@/utils/error';

export default class ProductOptionsRenderer extends Renderer {
	private readonly optionName: string;
	private readonly nameElement: HTMLElement | null;
	private readonly valuesContainer: HTMLElement;
	private readonly templateElement: HTMLElement | null;
	private valueElements: HTMLElement[] = [];
	private selectedOption: string;
	private isFirstRender: boolean = true;
	private productOption: ProductOption | null = null;

	constructor(product: Product, container: HTMLElement) {
		super(product, container);

		this.optionName = this.extractOptionName(container);
		this.selectedOption = this.getInitialSelectedOption();
		this.nameElement = container.querySelector('[data-bf-product-option-name]');
		this.valuesContainer = this.getValuesContainer(container);
		this.templateElement = this.createTemplateElement(container);
		this.productOption = this.getProductOption();

		if (!this.templateElement) {
			return;
		}

		this.setupEventListeners();
	}

	private extractOptionName(container: HTMLElement): string {
		return container.dataset.bfProductOptionName || '';
	}

	private getInitialSelectedOption(): string {
		return this.product.selectedVariant.selectedOptions.find((option) => option.name === this.optionName)?.value || '';
	}

	private getValuesContainer(container: HTMLElement): HTMLElement {
		return container.querySelector('[data-bf-product-option-values-container]') ?? container;
	}

	private createTemplateElement(container: HTMLElement): HTMLElement | null {
		const firstValue = container.querySelector('[data-bf-product-option-value]');
		if (!firstValue) {
			logger.warn(
				'No option value template found. Please add an element with the attribute "data-bf-product-option-value" inside the option container.',
			);
			return null;
		}

		firstValue.classList.remove('bf-selected', 'bf-unavailable');
		return firstValue.cloneNode(true) as HTMLElement;
	}

	private setupEventListeners(): void {
		subscribeEvent('product:variant-change', (detail) => {
			if (detail?.productId === this.product.id) {
				this.handleVariantChange();
			}
		});
	}

	private handleVariantChange(): void {
		const newSelectedOption = this.product.selectedVariant.selectedOptions.find(
			(option) => option.name === this.optionName,
		)?.value;

		if (newSelectedOption && newSelectedOption !== this.selectedOption) {
			this.selectedOption = newSelectedOption;
			this.render();
		}
	}

	render(): void {
		if (!this.isValidOption() || this.product.details.variants.edges.length === 1) {
			this.hideContainer();
			return;
		}

		this.showContainer();
		this.renderOptionName();

		if (!this.productOption) {
			this.hideContainer();
			return;
		}

		if (this.isFirstRender) {
			this.clearExistingValues();
			this.renderOptionValues();
			this.isFirstRender = false;
		}
		this.updateSelectedStates();
	}

	private isValidOption(): boolean {
		return !!this.optionName && this.optionName !== '{{ Connect Your Shopify Product Option Name }}';
	}

	private hideContainer(): void {
		this.container.style.display = 'none';
	}

	private showContainer(): void {
		this.container.style.display = '';
	}

	private renderOptionName(): void {
		if (this.nameElement) {
			this.nameElement.textContent = this.optionName;
		}
	}

	private getProductOption(): ProductOption | null {
		const option = this.product.details.options.find((opt) => opt.name.toLowerCase() === this.optionName.toLowerCase());

		if (!option) {
			logger.warn(`Option with name "${this.optionName}" not found in product options.`);
			return null;
		}

		return option;
	}

	private clearExistingValues(): void {
		this.valuesContainer.querySelectorAll('[data-bf-product-option-value]').forEach((el) => {
			el.remove();
		});
	}

	private renderOptionValues(): void {
		if (!this.templateElement) {
			logger.error('Template element not found for option values.');
			this.hideContainer();
			return;
		}

		this.valueElements = this.productOption!.optionValues.map((value) => {
			return this.createValueElement(value);
		});
	}

	private createValueElement(value: OptionValue): HTMLElement {
		const elem = this.templateElement!.cloneNode(true) as HTMLElement;

		this.setElementAttributes(elem, value);
		this.renderValueImage(elem, value);
		this.renderValueColor(elem, value);
		this.renderValueText(elem, value);
		this.attachClickHandler(elem, value);

		this.valuesContainer.appendChild(elem);
		return elem;
	}

	private getOptionAvailability(value: OptionValue): boolean {
		return this.product.details.variants.edges.some((edge) => {
			const variant = edge.node;
			const hasThisOption = variant.selectedOptions.some(
				(option) => option.name === this.optionName && option.value === value.name,
			);
			if (!hasThisOption) return false;
			return !!variant.availableForSale;
		});
	}

	private setElementAttributes(elem: HTMLElement, value: OptionValue): void {
		elem.setAttribute('data-option-value', value.name);
		elem.setAttribute('data-option-name', this.optionName);
	}

	private renderValueImage(elem: HTMLElement, value: OptionValue): void {
		const imageEl = elem.querySelector('[data-bf-product-option-value-image]') as HTMLImageElement;
		if (!imageEl) return;

		if (value.swatch?.image) {
			const img = imageEl.querySelector('img') || document.createElement('img');
			img.src = value.swatch.image.previewImage.url;
			img.alt = value.swatch.image.alt || value.name;

			if (!imageEl.querySelector('img')) {
				imageEl.appendChild(img);
			}
			imageEl.style.display = '';
		} else {
			imageEl.style.display = 'none';
		}
	}

	private renderValueColor(elem: HTMLElement, value: OptionValue): void {
		const colorEl = elem.querySelector('[data-bf-product-option-value-color]') as HTMLElement;
		if (!colorEl) return;

		if (value.swatch?.color && !value.swatch?.image) {
			colorEl.style.backgroundColor = value.swatch.color;
			colorEl.style.display = '';
		} else {
			colorEl.style.display = 'none';
		}
	}

	private renderValueText(elem: HTMLElement, value: OptionValue): void {
		const textEl = elem.querySelector('[data-bf-product-option-value-text]') as HTMLElement;
		if (textEl) {
			textEl.textContent = value.name;
			textEl.style.display = '';
		}
	}

	private attachClickHandler(elem: HTMLElement, value: OptionValue): void {
		elem.addEventListener('click', (e) => {
			e.preventDefault();
			this.handleOptionClick(elem, value);
		});
	}

	private handleOptionClick(elem: HTMLElement, value: OptionValue): void {
		this.selectedOption = value.name;
		this.updateSelectedState(elem);

		const matchingVariant = this.findMatchingVariant();
		this.product.selectVariant(matchingVariant.id);

		this.publishOptionChangeEvent();
	}

	private updateSelectedState(selectedElem: HTMLElement): void {
		this.valueElements.forEach((elem) => elem.classList.remove('bf-selected'));
		selectedElem.classList.add('bf-selected');
	}

	private updateSelectedStates(): void {
		this.valueElements.forEach((elem) => {
			const optionValue = elem.getAttribute('data-option-value');
			if (optionValue === this.selectedOption) {
				elem.classList.add('bf-selected');
			} else {
				elem.classList.remove('bf-selected');
			}

			const option = this.productOption?.optionValues.find((opt) => opt.name === optionValue);
			const isAvailable = option ? this.getOptionAvailability(option) : false;
			if (isAvailable) {
				elem.classList.remove('bf-unavailable');
			} else {
				elem.classList.add('bf-unavailable');
			}
		});
	}

	private publishOptionChangeEvent(): void {
		publishEvent('product:option-change', {
			option: this.selectedOption,
			optionName: this.optionName,
			productId: this.product.details.id,
		});
	}

	private findMatchingVariant() {
		const selectedOptions = this.buildSelectedOptionsMap();

		return (
			this.product.details.variants.edges.find((edge) => {
				const variant = edge.node;
				return variant.selectedOptions.every((option) => selectedOptions[option.name] === option.value);
			})?.node || this.product.details.variants.edges[0].node
		);
	}

	private buildSelectedOptionsMap(): Record<string, string> {
		const selectedOptions = this.product.selectedVariant.selectedOptions.reduce(
			(acc, option) => {
				acc[option.name] = option.value;
				return acc;
			},
			{} as Record<string, string>,
		);

		selectedOptions[this.optionName] = this.selectedOption;
		return selectedOptions;
	}
}
