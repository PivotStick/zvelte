const filters = {
	/**
	 * @param {number} number
	 */
	round(number) {
		return Math.round(number);
	},

	/**
	 * @param {*} value
	 */
	json_encode(value) {
		return JSON.stringify(value);
	},
};

/**
 * @param {string} filterName
 * @param {Record<string, (...args: any[]) => any>=} customFilters
 * @param {any[]} args
 */
export const runFilter = (filterName, customFilters = {}, ...args) => {
	if (filterName in filters) {
		return filters[filterName](...args);
	} else if (filterName in customFilters) {
		return customFilters[filterName](...args);
	} else {
		console.warn(`Unhandled filter "${filterName}"`);
		return '';
	}
};
