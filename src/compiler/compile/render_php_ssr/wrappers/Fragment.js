import Wrapper from '../shared/Wrapper.js';
import { mapChildren } from '../shared/mapChildren.js';

export default class Fragment extends Wrapper {
	/**
	 * @param {import('../Renderer.js').default} renderer
	 * @param {import('../Block.js').default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);
		this.children = mapChildren(renderer, block, parent, node.children);
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("php-parser").Identifier=} parentNode
	 */
	render(block, parentNode) {
		this.children.forEach((child) => child.render(block, parentNode));
	}
}
