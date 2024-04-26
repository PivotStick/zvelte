import { is_void } from '../../../shared/utils/names.js';
import { x } from '../php_printer/index.js';
import { mapChildren } from '../shared/mapChildren.js';
import Wrapper from '../shared/Wrapper.js';
import Fragment from './Fragment.js';

export default class Element extends Wrapper {
	/**
	 * @param {import('../Renderer.js').default} renderer
	 * @param {import('../Block.js').default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);

		this.void = is_void(this.node.name);

		this.attributes = mapChildren(
			renderer,
			block,
			parent,
			node.attributes,
		).filter((attr) => !attr.isEvent);

		if (node.children && !this.void) {
			this.fragment = new Fragment(renderer, block, parent, node);
		}
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("php-parser").Identifier=} parentNode
	 */
	render(block, parentNode) {
		block.concat(x`'<${this.node.name}'`);
		this.attributes.forEach((attr) =>
			attr.render(block, parentNode, this.node),
		);

		if (this.void) {
			block.concat(x`'/>'`);
		} else {
			if (this.fragment) {
				block.concat(x`'>'`);
				this.fragment.render(block, parentNode);
				block.concat(x`'</${this.node.name}>'`);
			} else {
				block.concat(x`'></${this.node.name}>'`);
			}
		}
	}
}
