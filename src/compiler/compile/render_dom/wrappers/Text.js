import { x } from 'code-red';
import Wrapper from '../shared/Wrapper.js';

export class Text extends Wrapper {
	/**
	 * @param {import("../Renderer.js").default} renderer
	 * @param {import("../Block.js").default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);
		this.skip = node.data.trim() === '';
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("estree").Identifier} parentNode
	 * @param {import("estree").Identifier} parentNodes
	 */
	render(block, parentNode, parentNodes) {
		if (this.skip) return;
		/**
		 * @type {import("estree").Literal}
		 */
		const stringLiteral = {
			type: 'Literal',
			value: this.node.data,
		};

		const id = block.getUniqueName('t');

		block.addElement(id, x`@text(${stringLiteral})`, parentNode);

		if (block.renderer.options.hydratable) {
			block.chunks.claim.push(
				x`${id} = @claimText(${parentNodes}, ${stringLiteral})`,
			);
		}
	}
}
