import { expressionToPhp } from "../../../parse/utils/expressionToPhp.js";
import { b, x } from "../php_printer/index.js";
import Wrapper from "../shared/Wrapper.js";
import { attributeValueToPhp } from "../shared/attributeValueToPhp.js";

/**
 * @extends Wrapper<import("../../../parse/types.d.ts").Attribute>
 */
export default class Attribute extends Wrapper {
    /**
     * @param {import('../Renderer.js').default} renderer
     * @param {import('../Block.js').default} block
     * @param {Wrapper<import("../../../parse/types.d.ts").Element>} parent
     * @param {*} node
     */
    constructor(renderer, block, parent, node) {
        super(renderer, block, parent, node);
        this.isEvent = node.name === "on" && node.modifier !== null;

        this.name = this.node.modifier
            ? `${this.node.name}:${this.node.modifier}`
            : this.node.name;
    }

    /**
     * @param {import("../Block.js").default} block
     * @param {import("php-parser").Identifier=} parentNode
     * @param {any=} element
     */
    render(block, parentNode, element) {
        if (this.isEvent) return;

        if (typeof this.node.value === "boolean") {
            block.concat(x`' ${this.name}'`);
        } else {
            const isDynamic = this.node.value.find((n) => n.type !== "Text");
            if (isDynamic) {
                block.nodes.push(
                    x`$v = ${attributeValueToPhp(this.node.value)};`,
                );
                if (
                    (element.name === "button" &&
                        this.node.name === "disabled") ||
                    (element.name === "input" &&
                        (this.node.name === "checked" ||
                            this.node.name === "disabled"))
                ) {
                    block.concat(x`$v ? ' ${this.name}' : ''`);
                } else {
                    block.concat(
                        x`$v !== null ? ' ${this.name}="' . $v . '"' : ''`,
                    );
                }
            } else {
                block.concat(x`' ${this.name}="'`);
                block.concat(attributeValueToPhp(this.node.value));
                block.concat(x`'"'`);
            }
        }
    }
}
