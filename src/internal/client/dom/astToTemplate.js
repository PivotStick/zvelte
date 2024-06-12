import { appendStyles } from "../shared.js";
import { isVoid } from "../../../compiler/shared/utils/names.js";

// @ts-ignore
import * as $ from "svelte/internal/client";
import { walk } from "zimmerframe";
import { analyseComponent } from "../../../compiler/phases/2-analyze/index.js";
import { renderStylesheet } from "../../../compiler/phases/3-transform/css/index.js";

/**
 * @param {import("#ast").ZvelteNode} ast
 */
export function addTemplatesToAST(ast) {
    newRoot(ast);
}

/**
 * @param {import("#ast").ZvelteNode} node
 * @param {{ src: string; }} template
 */
function addRoot(node, template) {
    // @ts-ignore
    node.__root = $.template(template.src, 1);
}

/**
 * @param {import("#ast").ZvelteNode} node
 */
function newRoot(node) {
    const template = { src: "" };
    handle(node, template);
    addRoot(node, template);
}

/**
 * @param {import("#ast").ZvelteNode} node
 * @param {{ src: string }} template
 */
function handle(node, template) {
    switch (node.type) {
        case "Root":
            const analysis = analyseComponent(node);
            if (analysis.css) {
                const { code, hash } = analysis.css;

                const result = renderStylesheet(code, analysis, {
                    dev: false,
                    filename: hash + ".css",
                });

                appendStyles(undefined, hash, result.code);
            }

            handle(node.fragment, template);
            break;

        case "Fragment":
            node.nodes.forEach((childNode) => {
                handle(childNode, template);
            });
            break;

        case "Text":
            if (node.data.trim() === "") {
                template.src += " ";
                break;
            }

            template.src += node.data;
            break;

        case "RegularElement":
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
            if (node.value === true) {
                template.src += ` ${node.name}`;
                break;
            }

            if (node.value.length === 1 && node.value[0].type === "Text") {
                template.src += ` ${node.name}="`;
                handle(node.value[0], template);
                template.src += '"';
            }

            break;

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

        case "ZvelteComponent": {
            template.src += "<!>";
            newRoot(node.fragment);
            break;
        }

        case "Component": {
            template.src += `<${node.name}><!></${node.name}>`;
            newRoot(node.fragment);
            break;
        }

        case "SnippetBlock": {
            template.src += `<!>`;
            newRoot(node.body);
            break;
        }

        case "KeyBlock": {
            template.src += `<!>`;
            newRoot(node.fragment);
            break;
        }

        case "Comment":
            template.src += `<!--${node.data}-->`;
            break;

        case "RenderTag":
        case "Variable":
        case "HtmlTag":
        case "ExpressionTag":
            template.src += "<!>";
            break;

        default:
            throw new Error(
                `${node.type} node not handled in template rendering`
            );
    }
}
