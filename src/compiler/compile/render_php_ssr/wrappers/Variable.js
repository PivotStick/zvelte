import { expressionToPhp } from "../../../parse/utils/expressionToPhp.js";
import { x } from "../php_printer/index.js";
import Wrapper from "../shared/Wrapper.js";

/**
 * @extends Wrapper<import("../../../parse/types.d.ts").Variable>
 */
export default class Variable extends Wrapper {
    /**
     * @param {import('../Renderer.js').default} renderer
     * @param {import('../Block.js').default} block
     * @param {Wrapper} parent
     * @param {*} node
     */
    constructor(renderer, block, parent, node) {
        super(renderer, block, parent, node);
    }

    /**
     * @param {import("../Block.js").default} block
     * @param {import("php-parser").Identifier=} parentNode
     */
    render(block, parentNode) {
        if (this.node.name.type === "Identifier") {
            this.renderer.ctxVars.push(this.node.name.name);
        }

        block.nodes.push(
            x`${expressionToPhp(this.node.name)} = $${expressionToPhp(
                this.node.value,
            )};`,
        );
    }
}
