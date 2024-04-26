export function run(fn) {
	return fn();
}

/**
 * @param {Function[]} fns
 * @returns {void}
 */
export function runAll(fns) {
	fns.forEach(run);
}

export function noop() {}
