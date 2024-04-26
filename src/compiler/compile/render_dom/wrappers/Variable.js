import { b, x } from 'code-red';
import Wrapper from '../shared/Wrapper.js';

export default class Variable extends Wrapper {
	/**
	 * @param {import('../Renderer.js').default} renderer
	 * @param {import('../Block.js').default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("estree").Identifier=} parentNode
	 */
	render(block, parentNode) {
		this.renderer.ctxVars.push(this.node.name);
		block.chunks.create.push(
			x`#ctx.vars.${this.node.name} = ${this.expressionToJS(
				this.node.value,
			)}`,
		);
	}
}
