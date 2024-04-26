import { expressionToPhp } from '../../../parse/utils/expressionToPhp.js';
import Block from '../Block.js';
import { x } from '../php_printer/index.js';
import Wrapper from '../shared/Wrapper.js';
import Fragment from './Fragment.js';

class IfBlockBranch extends Wrapper {
	/**
	 * @param {import('../Renderer.js').default} renderer
	 * @param {import('../Block.js').default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);

		renderer.blocks.push(block);

		this.block = block;
		this.fragment = new Fragment(renderer, block, parent, node);
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("php-parser").Identifier=} parentNode
	 */
	render(block, parentNode) {
		this.fragment.render(this.block);
	}
}

export default class IfBlock extends Wrapper {
	/**
	 * @param {import('../Renderer.js').default} renderer
	 * @param {import('../Block.js').default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);

		this.branches = [];

		/**
		 * @param {any} branch
		 */
		const toTernary = (branch) => {
			let b = new Block({
				name:
					branch.type === 'ElseBlock'
						? renderer.uniqueName('elseBlock')
						: branch.elseif
						? renderer.uniqueName('elseIfBlock')
						: renderer.uniqueName('ifBlock'),
			});

			this.branches.push(new IfBlockBranch(renderer, b, parent, branch));

			if (branch.type === 'ElseBlock') {
				return x`self::${b.name}($ctx)`;
			} else {
				return {
					kind: 'retif',
					test: expressionToPhp(branch.expression),
					trueExpr: x`self::${b.name}($ctx)`,
					falseExpr: branch.else ? toTernary(branch.else) : x`''`,
				};
			}
		};

		this.ternary = toTernary(this.node);
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("php-parser").Identifier=} parentNode
	 */
	render(block, parentNode) {
		block.concat(this.ternary);
		this.branches.forEach((branch) => branch.render());
	}
}
