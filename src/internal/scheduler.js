export const dirty_components = [];

const resolved_promise = Promise.resolve();
let update_scheduled = false;
let flushidx = 0;

/** @returns {void} */
export function schedule_update() {
	if (!update_scheduled) {
		update_scheduled = true;
		resolved_promise.then(flush);
	}
}

export function flush() {
	// Do not reenter flush while dirty components are updated, as this can
	// result in an infinite loop. Instead, let the inner flush handle it.
	// Reentrancy is ok afterwards for bindings etc.
	if (flushidx !== 0) {
		return;
	}
	for (let i = 0; i < dirty_components.length; i++) {
		const c = dirty_components[i];
	}
	dirty_components.length = 0;
	update_scheduled = false;
}
