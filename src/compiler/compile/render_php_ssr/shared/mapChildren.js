import Text from "../wrappers/Text.js";
import Element from "../wrappers/Element.js";
import MustacheTag from "../wrappers/MustacheTag.js";
import Attribute from "../wrappers/Attribute.js";
import IfBlock from "../wrappers/IfBlock.js";
import ForBlock from "../wrappers/ForBlock.js";
import Variable from "../wrappers/Variable.js";

const wrappers = {
    Text,
    Element,
    MustacheTag,
    Attribute,
    IfBlock,
    ForBlock,
    Variable,
};

/**
 * @param {import("../Renderer.js").default} renderer
 * @param {import("../Block.js").default} block
 * @param {import("./Wrapper.js").default} parent
 * @param {any[]} nodes
 *
 * @returns {InstanceType<typeof wrappers[keyof typeof wrappers]>[]}
 */
export const mapChildren = (renderer, block, parent, nodes) => {
    return nodes.map((node) => {
        /** @type {typeof wrappers[keyof typeof wrappers]} */
        const constructor = wrappers[node.type];
        if (!constructor) throw new Error(`Unhandled node type "${node.type}"`);
        return new constructor(renderer, block, parent, node);
    });
};
