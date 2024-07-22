/** @import { ZvelteNode } from '#ast' */

/** @typedef {{ start?: number, end?: number }} NodeLike */

/**
 * The current stack of ignored warnings
 * @type {Set<string>[]}
 */
export let ignore_stack = [];

/**
 * For each node the list of warnings that should be ignored for that node.
 * Exists in addition to `ignore_stack` because not all warnings are emitted
 * while the stack is being built.
 * @type {Map<ZvelteNode | NodeLike, Set<string>[]>}
 */
export let ignore_map = new Map();

/**
 * @param {string[]} ignores
 */
export function push_ignore(ignores) {
    const next = new Set([...(ignore_stack.at(-1) || []), ...ignores]);
    ignore_stack.push(next);
}

export function pop_ignore() {
    ignore_stack.pop();
}
