import { x } from '../php_printer/index.js';
import Wrapper from '../shared/Wrapper.js';

export default class Text extends Wrapper {
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
	 * @param {import("php-parser").Identifier=} parentNode
	 */
	render(block, parentNode) {
		block.concat(x`'${this.node.data}'`);
	}
}
