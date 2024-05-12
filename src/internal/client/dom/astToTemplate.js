import { appendStyles } from "../shared.js";
import { walk } from "estree-walker";
import { hash } from "../../../compiler/utils/hash.js";
import * as cssTree from "css-tree";
import { isVoid } from "../../../compiler/shared/utils/names.js";

// @ts-ignore
import * as $ from "svelte/internal/client";

/**
 * @param {import("#ast").Any} ast
 */
export function addTemplatesToAST(ast) {
    newRoot(ast);
}

/**
 * @param {import("#ast").Any} node
 * @param {{ src: string; }} template
 */
function addRoot(node, template) {
    // @ts-ignore
    node.__root = $.template(template.src, 1);
}

/**
 * @param {import("#ast").Any} node
 */
function newRoot(node) {
    const template = { src: "" };
    handle(node, template);
    addRoot(node, template);
}

/**
 * @param {import("#ast").Any} node
 * @param {{ src: string }} template
 */
function handle(node, template) {
    switch (node.type) {
        case "Root":
            if (node.css) {
                const styleSheetId = "zvelte-" + hash(node.css.code);
                // @ts-ignore
                walk(node.fragment, {
                    leave(/** @type {import("#ast").Any} */ node) {
                        if (node.type === "Element") {
                            let classAttr = node.attributes.find(
                                (attr) =>
                                    attr.type === "Attribute" &&
                                    attr.name === "class",
                            );
                            if (classAttr?.type !== "Attribute") {
                                classAttr = {
                                    type: "Attribute",
                                    name: "class",
                                    start: -1,
                                    end: -1,
                                    values: [],
                                };
                                node.attributes.push(classAttr);
                            }

                            if (classAttr.values !== true) {
                                let text = classAttr.values[0];

                                if (text?.type !== "Text") {
                                    text = {
                                        type: "Text",
                                        end: -1,
                                        start: -1,
                                        data: styleSheetId,
                                    };
                                    if (classAttr.values.length > 1) {
                                        text.data += " ";
                                    }
                                    classAttr.values.unshift(text);
                                } else {
                                    text.data = `${styleSheetId} ${text.data}`;
                                }
                            }
                        }
                    },
                });

                walk(node.css.ast, {
                    enter(/** @type {any} */ node) {
                        if (
                            node.type === "Atrule" &&
                            node.name === "keyframes"
                        ) {
                            this.skip();
                        }
                    },
                    leave(/** @type {any} */ node) {
                        if (node.type === "Selector") {
                            let index = 0;
                            for (let i = 0; i < node.children.length; i++) {
                                index = i;
                                const selector = node.children[i];
                                if (
                                    selector.type === "PseudoElementSelector" ||
                                    selector.type === "PseudoClassSelector"
                                ) {
                                    index--;
                                    break;
                                }
                            }

                            node.children.splice(index + 1, 0, {
                                type: "ClassSelector",
                                name: styleSheetId,
                                loc: null,
                            });
                        }
                    },
                });

                node.css.code = cssTree.generate(node.css.ast);

                // @ts-ignore
                appendStyles(undefined, styleSheetId, node.css.code);
            }

            handle(node.fragment, template);
            break;

        case "Fragment":
            node.nodes.forEach((childNode) => {
                handle(childNode, template);
            });
            break;

        case "Text":
            if (node.data === "") break;
            if (node.data.trim() === "") {
                template.src += " ";
                break;
            }

            template.src += node.data;
            break;

        case "Element":
            template.src += `<${node.name}`;

            node.attributes.forEach((attr) => {
                handle(attr, template);
            });

            if (isVoid(node.name)) {
                template.src += "/>";
            } else {
                template.src += ">";
                handle(node.fragment, template);
                template.src += `</${node.name}>`;
            }
            break;

        case "Attribute":
            if (node.values === true) {
                template.src += ` ${node.name}`;
                break;
            }

            if (node.values.length === 1 && node.values[0].type === "Text") {
                template.src += ` ${node.name}="`;
                handle(node.values[0], template);
                template.src += '"';
            }

            break;

        case "Variable":
        case "Comment":
        case "ClassDirective":
        case "TransitionDirective":
        case "BindDirective":
        case "OnDirective":
            break;

        case "IfBlock": {
            template.src += "<!>";
            newRoot(node.consequent);

            if (node.alternate) {
                newRoot(node.alternate);
            }
            break;
        }

        case "ForBlock": {
            template.src += "<!>";
            newRoot(node.body);

            if (node.fallback) {
                newRoot(node.fallback);
            }
            break;
        }

        case "Component": {
            template.src += `<${node.name}><!></${node.name}>`;
            newRoot(node.fragment);
            break;
        }

        case "HtmlTag":
        case "ExpressionTag":
            template.src += "<!>";
            break;

        default:
            throw new Error(
                `${node.type} node not handled in template rendering`,
            );
    }
}
