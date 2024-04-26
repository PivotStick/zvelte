import { x } from 'code-red';
import Wrapper from '../shared/Wrapper.js';
import { mapChildren } from '../shared/mapChildren.js';

export class Fragment extends Wrapper {
	/**
	 * @param {import("../Renderer.js").default} renderer
	 * @param {import("../Block.js").default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);
		this.children = mapChildren(renderer, block, this, node.children);
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("estree").Identifier=} parentNode
	 * @param {import("estree").Identifier=} parentNodes
	 */
	// @ts-ignore
	render(block, parentNode, parentNodes = x`#nodes`) {
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].render(block, parentNode, parentNodes);
		}
	}
}
