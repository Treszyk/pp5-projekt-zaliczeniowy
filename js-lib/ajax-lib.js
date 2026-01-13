const DEFAULT_OPTIONS = {
	baseURL: '',
	headers: {},
	timeout: 5000,
	fetchOptions: {},
};

class Ajax {
	constructor(options = {}) {
		this.options = {
			...DEFAULT_OPTIONS,
			...options,
			headers: {
				...DEFAULT_OPTIONS.headers,
				...(options.headers || {}),
			},
		};
	}

	async get(url, options = {}) {
		return this.request('GET', url, null, options);
	}

	async post(url, data, options = {}) {
		return this.request('POST', url, data, options);
	}

	async put(url, data, options = {}) {
		return this.request('PUT', url, data, options);
	}

	async delete(url, options = {}) {
		return this.request('DELETE', url, null, options);
	}

	async request(method, url, data, options = {}) {
		const mergedOptions = this.#mergeOptions(options);
		const controller = new AbortController();
		const timeoutId = setTimeout(
			() => controller.abort(new Error('Request timed out')),
			mergedOptions.timeout
		);

		const requestUrl = this.#buildUrl(mergedOptions.baseURL, url);
		const requestInit = this.#buildRequestInit(
			method,
			data,
			mergedOptions,
			controller.signal
		);

		try {
			const response = await fetch(requestUrl, requestInit);
			this.#clearTimeout(timeoutId);

			if (!response.ok) {
				const errorMessage = await this.#extractErrorMessage(response);
				throw new Error(
					`HTTP error ${response.status}: ${
						errorMessage || response.statusText
					}`
				);
			}

			return await response.json();
		} catch (error) {
			this.#clearTimeout(timeoutId);
			if (error.name === 'AbortError') {
				throw new Error('Request timed out');
			}
			if (error.message.startsWith('HTTP error')) {
				throw error;
			}
			throw new Error(`Network error: ${error.message}`);
		}
	}

	#mergeOptions(options) {
		return {
			...this.options,
			...options,
			headers: {
				...this.options.headers,
				...(options.headers || {}),
			},
			fetchOptions: {
				...this.options.fetchOptions,
				...(options.fetchOptions || {}),
			},
		};
	}

	#buildUrl(baseURL, url) {
		if (!baseURL) return url;
		try {
			return new URL(url, baseURL).toString();
		} catch (error) {
			throw new Error('Invalid URL provided');
		}
	}

	#buildRequestInit(method, data, options, signal) {
		const init = {
			method,
			headers: options.headers,
			signal,
			...options.fetchOptions,
		};

		if (data !== null && data !== undefined) {
			init.body = JSON.stringify(data);
		}

		return init;
	}

	#clearTimeout(timeoutId) {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}

	async #extractErrorMessage(response) {
		try {
			const data = await response.json();
			if (data && typeof data === 'object') {
				return data.message || data.error || JSON.stringify(data);
			}
			return String(data);
		} catch (error) {
			return null;
		}
	}
}

export default Ajax;
