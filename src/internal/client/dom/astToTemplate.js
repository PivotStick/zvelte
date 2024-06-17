import { isVoid } from "../../../compiler/shared/utils/names.js";

// @ts-ignore
import * as $ from "../runtime/index.js";
import { walk } from "zimmerframe";
import { analyseComponent } from "../../../compiler/phases/2-analyze/index.js";
import { renderStylesheet } from "../../../compiler/phases/3-transform/css/index.js";
import { cleanNodes } from "../../../compiler/phases/3-transform/utils.js";
import { escapeHtml } from "../../../compiler/escaping.js";

/**
 * @typedef {Pick<import("../types.js").State, "options"> & { template: { src: string } }} State
 */

/**
 * @param {import("#ast").ZvelteNode} ast
 * @param {import("../types.js").State["options"]} options
 */
export function addTemplatesToAST(ast, options) {
    /**
     * @type {State}
     */
    const state = {
        template: { src: "" },
        options,
    };

    walk(ast, state, visitors);
    addRoot(ast, state.template);
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
 * @param {(node: import("#ast").ZvelteNode, state?: State) => import("#ast").ZvelteNode} visit
 * @param {State} state
 */
function newRoot(node, visit, state) {
    const template = { src: "" };
    visit(node, { ...state, template });
    addRoot(node, template);
}

/**
 * @type {import("zimmerframe").Visitors<import("#ast").ZvelteNode, State>}
 */
const visitors = {
    Root(node, { visit }) {
        const analysis = analyseComponent(node);
        if (analysis.css) {
            const { code, hash } = analysis.css;

            const result = renderStylesheet(code, analysis, {
                dev: false,
                filename: hash + ".css",
            });

            $.append_styles(undefined, hash, result.code);
        }

        visit(node.fragment);
    },

    Fragment(node, { visit, state, path }) {
        const parent = path[path.length - 1];
        const { hoisted, trimmed } = cleanNodes(
            parent,
            node.nodes,
            path,
            undefined,
            state.options.preserveWhitespace,
            state.options.preserveComments
        );

        hoisted.forEach((childNode) => {
            visit(childNode);
        });

        trimmed.forEach((childNode) => {
            visit(childNode);
        });
    },

    Text(node, { state }) {
        state.template.src += node.data;
    },

    RegularElement(node, { visit, state }) {
        state.template.src += `<${node.name}`;

        const hasSpread = node.attributes.some(
            (a) => a.type === "SpreadAttribute"
        );

        node.attributes.forEach((attr) => {
            if (
                !(
                    hasSpread &&
                    (attr.type === "Attribute" ||
                        attr.type === "SpreadAttribute")
                )
            ) {
                visit(attr);
            }
        });

        if (isVoid(node.name)) {
            state.template.src += "/>";
        } else {
            state.template.src += ">";
            visit(node.fragment);
            state.template.src += `</${node.name}>`;
        }
    },

    Attribute(node, { visit, state }) {
        if (node.value === true) {
            state.template.src += ` ${node.name}`;
            return;
        }

        if (
            node.value.length === 1 &&
            node.value[0].type === "Text" &&
            node.value[0].data
        ) {
            state.template.src += ` ${node.name}="`;
            state.template.src += escapeHtml(node.value[0].data, true);
            state.template.src += '"';
        }
    },

    IfBlock(node, { state, visit }) {
        state.template.src += "<!>";
        newRoot(node.consequent, visit, state);

        if (node.alternate) {
            newRoot(node.alternate, visit, state);
        }
    },

    ForBlock(node, { state, visit }) {
        state.template.src += "<!>";
        newRoot(node.body, visit, state);

        if (node.fallback) {
            newRoot(node.fallback, visit, state);
        }
    },

    ZvelteComponent(node, { state, visit }) {
        state.template.src += "<!>";
        newRoot(node.fragment, visit, state);
    },

    Component(node, { state, visit }) {
        state.template.src += "<!>";
        newRoot(node.fragment, visit, state);
    },

    SnippetBlock(node, { state, visit }) {
        newRoot(node.body, visit, state);
    },

    KeyBlock(node, { state, visit }) {
        state.template.src += `<!>`;
        newRoot(node.fragment, visit, state);
    },

    Comment(node, { state }) {
        state.template.src += `<!--${node.data}-->`;
    },

    RenderTag(_, { state }) {
        state.template.src += "<!>";
    },

    HtmlTag(_, { state }) {
        state.template.src += "<!>";
    },

    Variable: TagVisitor,
    ExpressionTag: TagVisitor,
};

/**
 * @type {import("zimmerframe").Visitor<import("#ast").ZvelteNode, State, import("#ast").ZvelteNode>}
 */
function TagVisitor(_, { state }) {
    state.template.src += "<!--$$-->";
}
