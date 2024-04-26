import { b, x } from 'code-red';
import { walk } from 'estree-walker';

export default class Block {
	uuid = 0;

	/**
	 * @type {import("estree").Identifier}
	 */
	name;

	/**
	 * @type {string | undefined}
	 */
	comment;

	/**
	 * @type {Map<string, {
	 *  id: import("estree").Identifier,
	 *  init?: import("estree").Expression
	 * }>}
	 */
	variables = new Map();

	/** @type {import('estree').Node[]} */
	eventListeners = [];

	/** @type {Array<import("estree").Node[] | import("estree").Node>} */
	declarations = [];

	/** @type {Array<import("estree").Node[] | import("estree").Node>} */
	initializers = [];

	/**
	 * @type {import("./shared/Wrapper.js").default[]}
	 */
	wrappers = [];

	/**
	 * @type {((node: import("estree").Node) => void) | undefined}
	 */
	walker;

	/**
	 * @type {{
	 *  create: Array<import("estree").Node[] | import("estree").Node>;
	 *  claim: Array<import("estree").Node[] | import("estree").Node>;
	 *  hydrate: Array<import("estree").Node[] | import("estree").Node>;
	 *  mount: Array<import("estree").Node[] | import("estree").Node>;
	 *  update: Array<import("estree").Node[] | import("estree").Node>;
	 *  destroy: Array<import("estree").Node[] | import("estree").Node>;
	 * }}
	 */
	chunks = {
		create: [],
		claim: [],
		hydrate: [],
		mount: [],
		update: [],
		destroy: [],
	};

	/**
	 * @type {Block | null}
	 */
	parent;

	/**
	 * @param {{
	 *  name: string;
	 *  comment?: Block["comment"];
	 *  parent?: Block;
	 *  walker?: Block["walker"];
	 *  renderer: import("./Renderer.js").default;
	 * }} options
	 */
	constructor(options) {
		this.name = {
			type: 'Identifier',
			name: options.name,
		};

		this.renderer = options.renderer;
		this.comment = options.comment;
		this.parent = options.parent ?? null;
		this.walker = options.walker;
	}

	/**
	 * @param {import("estree").Identifier} id
	 * @param {import("estree").Expression} [init=undefined]
	 */
	addVariable(id, init = undefined) {
		if (this.variables.has(id.name)) {
			throw new Error(`${id.name} is already declared`);
		}

		this.variables.set(id.name, { id, init });
	}

	/**
	 * @param {import("estree").Identifier} id
	 * @param {import("estree").Node} renderStatement
	 * @param {import("estree").Node} parentNode
	 */
	addElement(id, renderStatement, parentNode) {
		this.addVariable(id);
		this.chunks.create.push(b`${id} = ${renderStatement}`);
		const hydratable = this.renderer.options.hydratable;

		if (parentNode) {
			const append = hydratable ? '@appendHydration' : '@append';
			this.chunks.mount.push(b`${append}(${parentNode}, ${id})`);
		} else {
			const insert = hydratable ? '@insertHydration' : '@insert';
			this.chunks.mount.push(b`${insert}(#target, ${id}, #anchor)`);
			this.chunks.destroy.push(b`@detach(${id})`);
		}
	}

	render() {
		const args = [x`#ctx`];

		const fn = b`function ${this.name}(${args}) {
      ${this.getContents()}
    }`;

		return this.comment
			? b`
    // ${this.comment}
    ${fn}
    `
			: fn;
	}

	getContents() {
		/** @type {Record<string, any>} */
		const properties = {};
		const noop = x`@noop`;

		this.renderListeners();

		if (this.chunks.create.length === 0) {
			properties.create = noop;
		} else {
			properties.create = x`function create() {
                ${this.chunks.create}
                ${this.chunks.hydrate.length ? x`this.hydrate()` : null}
            }`;
		}

		if (this.renderer.options.hydratable) {
			if (this.chunks.claim.length === 0) {
				properties.claim = noop;
			} else {
				properties.claim = x`function claim(#nodes) {
                    ${this.chunks.claim}
                    ${this.chunks.hydrate.length ? x`this.hydrate()` : null}
                }`;
			}

			if (this.chunks.hydrate.length > 0) {
				properties.hydrate = x`function hydrate() {
                    ${this.chunks.hydrate}
                }`;
			}
		}

		if (this.chunks.mount.length === 0) {
			properties.mount = noop;
		} else {
			properties.mount = x`function mount(#target, #anchor) {
                ${this.chunks.mount}
            }`;
		}

		if (this.chunks.update.length === 0) {
			properties.update = noop;
		} else {
			properties.update = x`function update() {
                ${this.chunks.update}
            }`;
		}

		if (this.chunks.destroy.length === 0) {
			properties.destroy = noop;
		} else {
			properties.destroy = x`function destroy() {
                ${this.chunks.destroy}
            }`;
		}

		for (const key in properties) {
			if (properties.hasOwnProperty(key)) {
				const property = properties[key];
				property.id = null;
			}
		}

		const returnValue = x`{
            create: ${properties.create},
            claim: ${properties.claim},
            hydrate: ${properties.hydrate},
            mount: ${properties.mount},
            update: ${properties.update},
            destroy: ${properties.destroy},
        }`;

		const body = b`
        ${this.declarations}

        ${Array.from(this.variables.values()).map(({ id, init }) => {
			return init ? b`let ${id} = ${init}` : b`let ${id}`;
		})}

        ${this.initializers}

        return ${returnValue}`;

		if (this.walker) {
			// @ts-ignore
			walk({ type: 'Program', body }, { enter: this.walker });
		}

		return body;
	}

	renderListeners() {
		if (this.eventListeners.length > 0) {
			this.addVariable({ type: 'Identifier', name: '#mounted' });
			this.chunks.destroy.push(x`#mounted = false`);

			/** @type {import('estree').Identifier} */
			const dispose = {
				type: 'Identifier',
				name: `#dispose`,
			};

			this.addVariable(dispose);

			if (this.eventListeners.length === 1) {
				this.chunks.mount.push(b`if (!#mounted) {
                    ${dispose} = ${this.eventListeners[0]}
                    #mounted = true
                }`);
				this.chunks.destroy.push(b`${dispose}()`);
			} else {
				this.chunks.mount.push(b`if (!#mounted) {
                    ${dispose} = [${this.eventListeners}]
                    #mounted = true
                }`);
				this.chunks.destroy.push(b`@runAll(${dispose})`);
			}
		}
	}

	/**
	 * @param {string} name
	 * @return {import("estree").Identifier}
	 */
	getUniqueName(name) {
		return {
			type: 'Identifier',
			name: `${name}_${this.uuid++}`,
		};
	}

	/**
	 * @param {ConstructorParameters<typeof Block>[0]} options
	 */
	child(options) {
		return new Block(Object.assign({}, this, options, { parent: this }));
	}
}
