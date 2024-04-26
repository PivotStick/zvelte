import { SyncWalker } from './sync.js';

/**
 * @typedef {import('php-parser').Node} Node
 * @typedef {import('./sync.js').SyncHandler} SyncHandler
 */

/**
 * @param {Node} ast
 * @param {{
 *   enter?: SyncHandler
 *   leave?: SyncHandler
 * }} walker
 * @returns {Node | null}
 */
export function walk(ast, { enter, leave }) {
	const instance = new SyncWalker(enter, leave);
	return instance.visit(ast, null);
}
