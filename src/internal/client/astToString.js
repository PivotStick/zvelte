import { handleAttributeValue, handleExpression } from "./shared";

/**
 * @param {import("../../compiler/parse/types").TemplateNode} node
 * @param {Record<string, any>[]} scope
 */
export function astToString(node, scope) {
    return handle(node, scope);
}

/**
 * @type {import("./shared").Handlers<import("../../compiler/parse/types").TemplateNode | import("../../compiler/parse/types").Fragment>}
 */
const handlers = {
    Element(node, scope) {
        let element = `<${node.name}`;

        node.attributes.forEach((attr) => {
            switch (attr.type) {
                case "Attribute": {
                    if (attr.value === true) {
                        element += ` ${attr.name}`;
                    } else {
                        const value = handleAttributeValue(attr, scope);
                        element += ` ${attr.name}="${value}"`;
                    }
                    break;
                }

                case "BindDirective": {
                    const value = handleExpression(attr.expression, scope);
                    element += ` ${attr.name}="${value}"`;
                    break;
                }

                case "OnDirective": {
                    // Ignore events for pure string rendering
                    break;
                }

                default:
                    // @ts-expect-error
                    throw new Error(`Attribute "${attr.type}" not handled`);
            }
        });

        element += ">";
        element += handle(node.fragment, scope);
        element += `</${node.name}>`;

        return element;
    },
    Text(node, scope) {
        return node.data;
    },
    Fragment(node, scope) {
        let fragment = "";

        node.nodes.forEach((childeNode) => {
            fragment += handle(childeNode, scope);
        });

        return fragment;
    },
    Root(node, scope) {
        return handle(node.fragment, scope);
    },
};

/**
 * @param {*} node
 * @param {Record<string, any>[]} scope
 */
function handle(node, scope) {
    const handler = handlers[node.type];
    if (!handler)
        throw new Error(`"${node.type}" not handled for string rendering`);
    return handler(node, scope);
}
