import { expressionToPhp } from '../../../parse/utils/expressionToPhp.js';
import Wrapper from '../shared/Wrapper.js';

export default class Attribute extends Wrapper {
	/**
	 * @param {import('../Renderer.js').default} renderer
	 * @param {import('../Block.js').default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);

		this.expression = expressionToPhp(this.node);
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("php-parser").Identifier=} parentNode
	 */
	render(block, parentNode) {
		block.concat(this.expression);
	}
}
