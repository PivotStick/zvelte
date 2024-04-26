import { expressionToPhp } from '../../../parse/utils/expressionToPhp.js';
import Block from '../Block.js';
import { b, x } from '../php_printer/index.js';
import Wrapper from '../shared/Wrapper.js';
import Fragment from './Fragment.js';

export default class ForBlock extends Wrapper {
	/**
	 * @param {import('../Renderer.js').default} renderer
	 * @param {import('../Block.js').default} block
	 * @param {Wrapper} parent
	 * @param {*} node
	 */
	constructor(renderer, block, parent, node) {
		super(renderer, block, parent, node);

		const itemVar = this.node.itemVar;

		this.forBlock = new Block({
			name: renderer.uniqueName('forBlock'),
		});

		this.itemBlock = new Block({
			name: renderer.uniqueName('forBlockItem'),
			/**
			 * @param {any} node
			 * @param {any} parent
			 */
			walker(node, parent) {
				switch (node.kind) {
					case 'propertylookup':
						if (
							node.what.name === 'ctx' &&
							node.offset.name === 'props'
						) {
							//console.log(parent);
							if (
								parent.offset.name === 'loop' ||
								parent.offset.name === itemVar
							) {
								node.offset.name = 'loopProps';
							}
						}
						break;
				}
			},
		});

		this.itemFragment = new Fragment(
			renderer,
			this.itemBlock,
			parent,
			this.node,
		);

		this.expression = expressionToPhp(this.node.expression);

		renderer.blocks.push(this.forBlock, this.itemBlock);

		if (this.node.else) {
			this.elseBlock = new Block({
				name: renderer.uniqueName('forEmptyBlock'),
			});
			this.elseFragment = new Fragment(
				renderer,
				this.elseBlock,
				parent,
				this.node.else,
			);
			renderer.blocks.push(this.elseBlock);
		}
	}

	/**
	 * @param {import("../Block.js").default} block
	 * @param {import("php-parser").Identifier=} parentNode
	 */
	render(block, parentNode) {
		this.forBlock.nodes.unshift(
			x`$list = ${this.expression};`,
			b`if (empty($list)) {
                return ${
					this.elseFragment
						? x`self::${this.elseBlock.name}($ctx)`
						: x`''`
				};
            }`,
		);

		this.forBlock.nodes.push(b`

        $i = 0;
        $loop = (object)[];

        foreach ($list as $key => $value) {

            $loop->index = $i + 1;
            $loop->index0 = $i;
            $loop->length = count($list);
            $loop->revindex = $loop->length - $loop->index0;
            $loop->revindex0 = $loop->length - $loop->index;
            $loop->first = $i === 0;
            $loop->last = $loop->index === $loop->length;

            $childCtx = (object)[
                ...(array)$ctx,
                'loopProps' => (object)[
                    'loop' => $loop,
                    '${this.node.itemVar}' => $list[$i],
                ],
            ];

            ${block.toConcat(x`self::${this.itemBlock.name}($childCtx)`)};
            
            $i++;
        }`);

		this.itemFragment.render(this.itemBlock);
		if (this.elseFragment) {
			this.elseFragment.render(this.elseBlock);
		}

		block.concat(x`self::${this.forBlock.name}($ctx)`);
	}
}
