/**
 * @template [T = any]
 */
export default class Wrapper {
    /**
     * @param {import('../Renderer.js').default} renderer
     * @param {import('../Block.js').default} block
     * @param {Wrapper} parent
     * @param {T} node
     */
    constructor(renderer, block, parent, node) {
        this.node = node;
        this.renderer = renderer;
        this.parent = parent;
    }

    /**
     * @param {import("../Block.js").default} block
     * @param {import("php-parser").Identifier=} parentNode
     */
    render(block, parentNode) {
        throw new Error("Wrapper class cannot be renderer");
    }
}
