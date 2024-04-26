import { b, c, x } from './php_printer/index.js';
import { walk } from './php_printer/utils/walker/index.js';

export default class Block {
	uuid = 0;

	/**
	 * @type {{ kind: "identifier"; name: string }}
	 */
	name;

	/**
	 * @type {string | undefined}
	 */
	comment;

	/**
	 * @type {import("php-parser").Node[]}
	 */
	nodes = [];

	/**
	 * @type {Block | null}
	 */
	parent;

	/**
	 * @type {import("./php_printer/utils/walker/sync.js").SyncHandler}
	 */
	walker;

	/**
	 * @param {{
	 *  name: string;
	 *  comment?: Block["comment"];
	 *  parent?: Block;
	 *  walker?: Block["walker"];
	 *  public?: boolean;
	 * }} options
	 */
	constructor(options) {
		this.nodes.push(x`$chunks = [];`);
		this.name = {
			kind: 'identifier',
			name: options.name,
		};

		this.comment = options.comment;
		this.parent = options.parent ?? null;
		this.walker = options.walker;
		this.public = options.public || false;
	}

	render() {
		const fn = c(
			// @ts-ignore
			[
				`${
					this.public === true ? 'public' : 'private'
				} static function `,
				`($ctx) { `,
				`; }`,
			],
			this.name,
			this.getContents(),
		);

		return this.comment ? b`// ${this.comment}\n${fn}` : fn;
	}

	getContents() {
		let hasChunksPush = false;
		/** @type {any} */
		let chunksDeclarationNode;

		const root = { kind: 'program', body: this.nodes };

		walk(
			// @ts-ignore
			root,
			{
				/**
				 * @param {any} node
				 */
				enter(node) {
					if (
						node.kind === 'expressionstatement' &&
						node.expression.kind === 'assign' &&
						node.expression.operator === '='
					) {
						if (
							node.expression.left.kind === 'offsetlookup' &&
							node.expression.left.offset === false &&
							node.expression.left.what.kind === 'variable' &&
							node.expression.left.what.name === 'chunks'
						) {
							hasChunksPush = true;
						} else if (
							node.expression.left.kind == 'variable' &&
							node.expression.left.name === 'chunks'
						) {
							chunksDeclarationNode = node;
						}
					}
				},
			},
		);

		let canReturnImplode = true;

		if (!hasChunksPush) {
			const value = chunksDeclarationNode.expression.right;
			if (value.items.length > 1) {
				chunksDeclarationNode.kind = 'return';
				chunksDeclarationNode.expr = x`implode('', $${value})`;
				canReturnImplode = false;
			} else if (value.items[0]) {
				chunksDeclarationNode.kind = 'return';
				chunksDeclarationNode.expr = value.items[0];
				canReturnImplode = false;
			}
		}

		if (canReturnImplode) {
			this.nodes.push({
				kind: 'return',
				// @ts-ignore
				expr: x`implode('', $chunks)`,
			});
		}

		const body = b`
            ${this.nodes};
        `;

		if (this.walker) {
			walk(body, { enter: this.walker });
		}

		return body;
	}

	/**
	 * @param {ConstructorParameters<typeof Block>[0]} options
	 */
	child(options) {
		return new Block(Object.assign({}, this, options, { parent: this }));
	}

	/**
	 * @param {any} node
	 */
	concat(node) {
		/**
		 * @type {any}
		 */
		const last = this.nodes[this.nodes.length - 1];

		if (
			last &&
			last.kind === 'expressionstatement' &&
			last.expression.kind === 'assign'
		) {
			const ex = last.expression;
			if (
				ex.left.kind === 'variable' &&
				ex.left.name === 'chunks' &&
				ex.right.kind === 'array'
			) {
				const lastItem = ex.right.items[ex.right.items.length - 1];
				if (lastItem?.kind === 'string' && node.kind === 'string') {
					const q = lastItem.isDoubleQuote ? '"' : "'";
					lastItem.value += node.value;
					lastItem.raw = `${q}${lastItem.value}${q}`;
					return;
				}
				ex.right.items.push(node);
				return;
			} else if (
				ex.left.kind === 'offsetlookup' &&
				ex.left.offset === false &&
				ex.left.what.kind === 'variable' &&
				ex.left.what.name === 'chunks' &&
				ex.right.kind === 'string' &&
				node.kind === 'string'
			) {
				const q = ex.right.isDoubleQuote ? '"' : "'";
				ex.right.value += node.value;
				ex.right.raw = `${q}${ex.right.value}${q}`;
				return;
			}
		}

		this.nodes.push(this.toConcat(node));
	}

	/**
	 * @param {any} node
	 */
	toConcat(node) {
		return x`$chunks[] = ${node};`;
	}
}
