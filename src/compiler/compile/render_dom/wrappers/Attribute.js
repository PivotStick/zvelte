import { x } from "code-red";
import Wrapper from "../shared/Wrapper.js";
import { walk } from "svelte/compiler";
import { attributeValueToJS } from "../shared/attributeValueToJS.js";
import { parseEventHandler } from "../../../../internal/dom.js";

export class Attribute extends Wrapper {
    /**
     * @param {import("../Renderer.js").default} renderer
     * @param {import("../Block.js").default} block
     * @param {Wrapper} parent
     * @param {*} node
     */
    constructor(renderer, block, parent, node) {
        super(renderer, block, parent, node);
        this.isListener = node.name === "on";
        this.modifier = node.modifier;
        this.needsUpdate = false;
        this.isDynamic =
            typeof node.value !== "boolean" &&
            !!node.value.find((n) => n.type !== "Text");

        walk(node, {
            enter: (n) => {
                if (n.type === "Identifier") {
                    this.needsUpdate = true;
                }
            },
        });

        this.name = node.name;
        this.value =
            typeof node.value === "boolean"
                ? x`${node.value}`
                : attributeValueToJS(node.value);
    }

    /**
     * @param {import("../Block.js").default} block
     * @param {import("estree").Identifier=} parentNode
     * @param {any=} element
     */
    render(block, parentNode, element) {
        if (this.isListener) {
            const listener = block.getUniqueName(
                `${parentNode.name}_${this.modifier}`,
            );

            if (this.isDynamic) {
                block.declarations.push(x`function ${listener}($e) {
                    const _ = @parseEventHandler(${this.value}, $e)
                    #ctx.listeners[_.methodName](..._.args);
                }`);
            } else {
                let e = {};
                const result = parseEventHandler(this.value.value, e);

                block.declarations.push(x`function ${listener}($e) {
                    #ctx.listeners["${result.methodName}"](${result.args
                        .map((a) => (a === e ? "$e" : `"${a}"`))
                        .join(", ")})
                }`);
            }

            block.eventListeners.push(
                x`@listen(${parentNode}, "${this.modifier}", ${listener})`,
            );
        } else {
            let expr;
            if (element.name === "button" && this.node.name === "disabled") {
                expr = x`${parentNode}.${this.name} = ${this.value}`;
            } else {
                expr = x`@attr(${parentNode}, "${this.name}", ${this.value})`;
            }

            if (this.renderer.options.hydratable) {
                block.chunks.hydrate.push(expr);
            } else {
                block.chunks.create.push(expr);
            }

            if (this.needsUpdate) {
                block.chunks.update.push(expr);
            }
        }
    }
}
