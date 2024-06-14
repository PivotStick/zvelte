import MagicString from "magic-string";
import { walk } from "zimmerframe";
import {
    is_keyframes_node,
    regex_css_name_boundary,
    remove_css_prefix,
} from "../../css.js";
import { analyseComponent } from "../../2-analyze/index.js";
import { generate } from "css-tree";

/**
 * @typedef {{
 *   code: string;
 *   hash: string;
 *   selector: string;
 * }} State
 */

/**
 *
 * @param {string} source
 * @param {ReturnType<typeof analyseComponent>} analysis
 * @param {{
 *  dev: boolean;
 *  filename: string;
 * }} options
 */
export function renderStylesheet(source, analysis, options) {
    if (!analysis.css) throw new Error(`expected css`);

    /** @type {State} */
    const state = {
        code: source,
        hash: analysis.css.hash,
        selector: `.${analysis.css.hash}`,
    };

    walk(
        /** @type {import("#ast").ZvelteNode} */ (analysis.template.ast),
        state,
        {
            RegularElement(node, { next, state }) {
                let classAttr = node.attributes.find(
                    (attr) => attr.type === "Attribute" && attr.name === "class"
                );
                if (classAttr?.type !== "Attribute") {
                    classAttr = {
                        type: "Attribute",
                        name: "class",
                        start: -1,
                        end: -1,
                        value: [],
                    };
                    node.attributes.push(classAttr);
                }

                if (classAttr.value !== true) {
                    let text = classAttr.value[0];

                    if (text?.type !== "Text") {
                        text = {
                            type: "Text",
                            end: -1,
                            start: -1,
                            data: state.hash,
                        };
                        if (classAttr.value.length > 0) {
                            text.data += " ";
                        }
                        classAttr.value.unshift(text);
                    } else {
                        text.data = `${state.hash} ${text.data}`;
                    }
                }

                next();
            },
        }
    );

    walk(analysis.css.ast, state, visitors);

    return {
        // @ts-ignore
        code: generate(analysis.css.ast),
    };
}

/** @type {import('zimmerframe').Visitors<import('css-tree').CssNodePlain, State>} */
const visitors = {
    _(node, { next }) {
        if (node.type !== "Atrule") {
            next();
        }
    },
    SelectorList(node, { state, path }) {
        for (const selector of node.children) {
            if (selector.type === "Selector") {
                let indexToAdd = -1;

                for (let i = selector.children.length - 1; i >= 0; i--) {
                    const child = selector.children[i];
                    if (
                        child.type === "PseudoClassSelector" &&
                        child.name === "global" &&
                        child.children?.[0]
                    ) {
                        selector.children[i] = child.children[0];
                        break;
                    } else if (child.type === "TypeSelector" || i === 0) {
                        indexToAdd = i + 1;
                        break;
                    }
                }

                if (indexToAdd !== -1) {
                    selector.children.splice(indexToAdd, 0, {
                        type: "ClassSelector",
                        name: state.hash,
                    });
                }
            }
        }
    },
};
