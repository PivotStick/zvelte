import { b, x } from 'code-red';
import Wrapper from '../shared/Wrapper.js';
import { Fragment } from './Fragment.js';

export class ForBlock extends Wrapper {
	/**
	 * @param {import("../Renderer.js").default} renderer
	 * @param {import("../Block.js").default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);

		this.fragment = new Fragment(renderer, block, parent, node);
		this.expression = this.expressionToJS(this.node.expression);

		this.block = block.child({
			walker: (node) => {
				if (
					node.type === 'MemberExpression' &&
					node.property.type === 'Identifier' &&
					node.object.type === 'MemberExpression' &&
					node.object.property.type === 'Identifier' &&
					node.object.property.name === 'props' &&
					(this.node.itemVar === node.property.name ||
						node.property.name === 'loop')
				) {
					node.object.property.name = 'loopProps';
				}
			},
			name: renderer.getUniqueName('createEachBlock'),
		});

		this.vars = {
			getCtxName: renderer.getUniqueName('getEachContext'),
		};

		renderer.addBlock(this.block);

		renderer.addBlock(b`function ${this.vars.getCtxName}(#ctx, #list, #index) {
            const loop = {};

            loop.index = #index + 1;
            loop.index0 = #index;
            loop.length = #list.length;
            loop.revindex = loop.length - loop.index0;
            loop.revindex0 = loop.length - loop.index;
            loop.first = #index === 0;
            loop.last = loop.index === loop.length;

            const childCtx = {
                ...#ctx,
                loopProps: {
                    loop,
                    ${this.node.itemVar}: #list[#index],
                }
            };

            return childCtx;
        }`);

		if (this.node.else) {
			this.elseBlock = block.child({
				name: renderer.getUniqueName('createElseBlock'),
			});
			this.elseFragment = new Fragment(
				renderer,
				this.elseBlock,
				parent,
				this.node.else,
			);
			renderer.addBlock(this.elseBlock);
		}
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("estree").Identifier=} parentNode
	 * @param {import("estree").Identifier=} parentNodes
	 */
	render(block, parentNode, parentNodes) {
		const forAnchor = block.getUniqueName('for_anchor');
		const forValue = block.getUniqueName('for_value');
		const forBlocks = block.getUniqueName('for_blocks');
		const forElse = this.node.else ? block.getUniqueName('for_else') : null;

		block.addVariable(forValue, x`@ensureArrayLike(${this.expression})`);
		block.addVariable(forBlocks, x`[]`);

		block.initializers.push(b`
        for (let i = 0; i < ${forValue}.length; i += 1) {
            ${forBlocks}[i] = ${this.block.name}(${this.vars.getCtxName}(#ctx, ${forValue}, i));
        }`);

		block.chunks.create.push(b`
        for (let i = 0; i < ${forBlocks}.length; i += 1) {
            ${forBlocks}[i].create()
        }`);

		if (this.renderer.options.hydratable) {
			block.chunks.claim.push(b`
                for (let i = 0; i < ${forBlocks}.length; i += 1) {
                    ${forBlocks}[i].claim(${parentNodes})
                }
            `);
			block.chunks.claim.push(x`${forAnchor} = @empty()`);
		}

		block.addElement(forAnchor, x`@empty()`, parentNode);

		block.chunks.mount.push(b`
        for (let i = 0; i < ${forBlocks}.length; i += 1) {
            if (${forBlocks}[i]) {
                ${forBlocks}[i].mount(${forAnchor}.parentNode, ${forAnchor})
            }
        }`);

		if (forElse) {
			this.elseFragment.render(this.elseBlock, null);
			block.addVariable(forElse, x`null`);
			block.initializers.push(b`if (!${forValue}.length) {
                ${forElse} = ${this.elseBlock.name}(#ctx)
            }`);

			block.chunks.create.push(b`if (${forElse}) {
                ${forElse}.create()
            }`);

			if (this.renderer.options.hydratable) {
				block.chunks.claim.push(b`if (${forElse}) {
                    ${forElse}.claim(${parentNodes})
                }`);
			}

			block.chunks.mount.push(b`if (${forElse}) {
                ${forElse}.mount(${forAnchor}.parentNode, ${forAnchor})
            }`);
		}

		block.chunks.update.push(b`
            {
                ${forValue} = @ensureArrayLike(${this.expression})
                let i;
                
                for (i = 0; i < ${forValue}.length; i += 1) {
                    const childCtx = ${
						this.vars.getCtxName
					}(#ctx, ${forValue}, i);
                    
                    if (${forBlocks}[i]) {
                        ${forBlocks}[i].update(childCtx)
                    } else {
                        ${forBlocks}[i] = ${this.block.name}(childCtx)
                        ${forBlocks}[i].create()
                        ${forBlocks}[i].mount(${forAnchor}.parentNode, ${forAnchor})
                    }
                }

                for (; i < ${forBlocks}.length; i += 1) {
                    ${forBlocks}[i].destroy()
                }

                ${forBlocks}.length = ${forValue}.length

                ${
					forElse
						? b`
                if (!${forValue}.length && ${forElse}) {
                    ${forElse}.update()
                } else if (!${forValue}.length) {
                    ${forElse} = ${this.elseBlock.name}(#ctx)
                    ${forElse}.create()
                    ${forElse}.mount(${forAnchor}.parentNode, ${forAnchor})
                } else if (${forElse}) {
                    ${forElse}.destroy()
                    ${forElse} = null
                }
                `
						: null
				}
            }
        `);

		block.chunks.destroy.push(b`@destroyEach(${forBlocks})`);

		this.block.chunks.update.push(b`if (arguments[0]) #ctx = arguments[0]`);
		this.fragment.render(this.block, null);
	}
}
