import { x } from 'code-red';
import Wrapper from '../shared/Wrapper.js';

export class MustacheTag extends Wrapper {
	/**
	 * @param {import("../Renderer.js").default} renderer
	 * @param {import("../Block.js").default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("estree").Identifier} parentNode
	 * @param {import("estree").Identifier} parentNodes
	 */
	render(block, parentNode, parentNodes) {
		const id = block.getUniqueName('t');
		const js = this.expressionToJS(this.node.expression);

		block.addElement(id, x`@text(${js})`, parentNode);
		block.chunks.update.push(x`${id}.data = ${js}`);
		if (block.renderer.options.hydratable) {
			block.chunks.claim.push(
				x`${id} = @claimText(${parentNodes}, ${js})`,
			);
		}
	}
}
