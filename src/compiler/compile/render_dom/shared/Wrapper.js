import { x } from 'code-red';
import { expressionToJS } from '../../../parse/utils/expressionToJS.js';

export default class Wrapper {
	/**
	 * @param {import('../Renderer.js').default} renderer
	 * @param {import('../Block.js').default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		this.node = node;
		this.renderer = renderer;
		this.parent = parent;

		block.wrappers.push(this);
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("estree").Identifier=} parentNode
	 * @param {import("estree").Identifier=} parentNodes
	 */
	render(block, parentNode, parentNodes) {
		throw new Error('Wrapper class cannot be renderer');
	}

	/**
	 * @param {any} expression
	 */
	expressionToJS(expression) {
		if (this.parent) {
			return this.parent.expressionToJS(expression);
		}

		return expressionToJS(expression, () => x`#ctx.props`);
	}
}
