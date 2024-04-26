import { b, x } from 'code-red';
import { expressionToJS } from '../../../parse/utils/expressionToJS.js';
import { expressionToRaw } from '../../../parse/utils/expressionToRaw.js';
import { Fragment } from './Fragment.js';
import Wrapper from '../shared/Wrapper.js';

class IfBlockBranch extends Wrapper {
	/**
	 * @param {import("../Renderer.js").default} renderer
	 * @param {import("../Block.js").default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);

		const isElse = node.type === 'ElseBlock';

		this.block = block.child({
			comment: isElse
				? '{% else %}'
				: node.elseif
				? `{% elseif ${expressionToRaw(node.expression)} %}`
				: `{% if ${expressionToRaw(node.expression)} %}`,
			name: renderer.getUniqueName(
				isElse ? 'createElseBlock' : 'createIfBlock',
			),
		});

		renderer.addBlock(this.block);

		if (!isElse) {
			this.condition = this.expressionToJS(node.expression);
		}

		this.fragment = new Fragment(renderer, block, parent, node);
	}
}

export class IfBlock extends Wrapper {
	hasElse = false;

	/**
	 * @param {import("../Renderer.js").default} renderer
	 * @param {import("../Block.js").default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);

		/**
		 * @type {IfBlockBranch[]}
		 */
		this.branches = [];

		/**
		 * @param {any} node
		 */
		const createBranches = (node) => {
			const ifBranch = new IfBlockBranch(renderer, block, parent, node);
			this.branches.push(ifBranch);

			// Is else if
			if (node.else?.type === 'IfBlock') {
				createBranches(node.else);
			} else if (node.else) {
				this.hasElse = true;
				const elseBranch = new IfBlockBranch(
					renderer,
					block,
					parent,
					node.else,
				);
				this.branches.push(elseBranch);
			}
		};

		createBranches(this.node);
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("estree").Identifier=} parentNode
	 * @param {import("estree").Identifier=} parentNodes
	 */
	render(block, parentNode, parentNodes) {
		this.branches.forEach((branch) => {
			branch.fragment.render(branch.block, null);
		});

		if (this.branches.length > 1) {
			this.renderCompound(block, parentNode, parentNodes);
		} else {
			this.renderSimple(block, parentNode, parentNodes);
		}
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("estree").Identifier=} parentNode
	 * @param {import("estree").Identifier=} parentNodes
	 */
	renderSimple(block, parentNode, parentNodes) {
		const ifBlock = block.getUniqueName('if_block');
		const ifBlockAnchor = block.getUniqueName('if_block_anchor');
		const branch = this.branches[0];

		block.chunks.create.push(b`if (${ifBlock}) ${ifBlock}.create()`);
		if (this.renderer.options.hydratable) {
			block.chunks.claim.push(
				b`if (${ifBlock}) ${ifBlock}.claim(${parentNodes})`,
			);
		}
		block.chunks.update.push(b`if (${branch.condition}) {
            if (${ifBlock}) {
                ${
					branch.block.chunks.update.length
						? x`${ifBlock}.update()`
						: null
				}
            } else {
                ${ifBlock} = ${branch.block.name}(#ctx)
                ${ifBlock}.create()
                ${ifBlock}.mount(${ifBlockAnchor}.parentNode, ${ifBlockAnchor})
            }
        } else if (${ifBlock}) {
            ${ifBlock}.destroy()
            ${ifBlock} = null
        }`);
		block.chunks.destroy.push(b`if (${ifBlock}) ${ifBlock}.destroy()`);
		block.addElement(ifBlockAnchor, x`@empty()`, parentNode);
		block.addVariable(
			ifBlock,
			x`${branch.condition} && ${branch.block.name}(#ctx)`,
		);
		if (this.renderer.options.hydratable) {
			block.chunks.claim.push(x`${ifBlockAnchor} = @empty()`);
		}
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("estree").Identifier=} parentNode
	 * @param {import("estree").Identifier=} parentNodes
	 */
	renderCompound(block, parentNode, parentNodes) {
		const select = block.getUniqueName('select_block_type');
		const current = block.getUniqueName('current_block_type');
		const ifBlock = block.getUniqueName('if_block');
		const ifBlockAnchor = block.getUniqueName('if_block_anchor');

		block.declarations.push(x`function ${select}() {
            ${this.branches.map((branch) =>
				branch.condition
					? b`if (${branch.condition}) return ${branch.block.name}`
					: b`return ${branch.block.name}`,
			)}
        }`);

		block.addVariable(current, x`${select}()`);
		block.addVariable(
			ifBlock,
			this.hasElse
				? x`${current}(#ctx)`
				: x`${current} && ${current}(#ctx)`,
		);

		block.chunks.mount.push(
			this.hasElse
				? x`${ifBlock}.mount(#target, #anchor)`
				: b`if (${ifBlock}) ${ifBlock}.mount(#target, #anchor)`,
		);

		block.chunks.create.push(
			this.hasElse
				? x`${ifBlock}.create()`
				: b`if (${ifBlock}) ${ifBlock}.create()`,
		);

		block.addElement(ifBlockAnchor, x`@empty()`, parentNode);

		if (this.renderer.options.hydratable) {
			block.chunks.claim.push(
				this.hasElse
					? x`${ifBlock}.claim(${parentNodes})`
					: b`if (${ifBlock}) ${ifBlock}.claim(${parentNodes})`,
			);
			block.chunks.claim.push(x`${ifBlockAnchor} = @empty()`);
		}

		block.chunks.update.push(b`
        if (${current} === (${current} = ${select}()) && ${ifBlock}) {
            ${ifBlock}.update()
        } else {
            ${
				this.hasElse
					? b`
                ${ifBlock}.destroy()
                ${ifBlock} = ${current}(#ctx)
                `
					: b`
                if (${ifBlock}) ${ifBlock}.destroy()
                ${ifBlock} = ${current} && ${current}(#ctx)
                `
			}

            if (${ifBlock}) {
                ${ifBlock}.create();
                ${ifBlock}.mount(${ifBlockAnchor}.parentNode, ${ifBlockAnchor});
            }
        }`);

		block.chunks.destroy.push(
			this.hasElse
				? x`${ifBlock}.destroy()`
				: b`if (${ifBlock}) ${ifBlock}.destroy()`,
		);
	}
}
