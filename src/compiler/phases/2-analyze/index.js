import { walk } from "zimmerframe";
import { hash } from "../../utils/hash.js";
import {
    Scope,
    ScopeRoot,
    createScopes,
} from "../3-transform/render_dom/scope.js";
import { analyze_css } from "./css/css-analyze.js";
import { prune } from "./css/css-prune.js";
import { create_attribute } from "../nodes.js";
import { MathMLElements, SVGElements } from "../3-transform/constants.js";
import { regex_starts_with_newline } from "../patterns.js";

/**
 * @param {import("#ast").Root} root
 * @param {import("../../types.js").CompilerOptions} options
 */
export function analyseComponent(root, options) {
    const scopeRoot = new ScopeRoot();

    const { scope, scopes } = createScopes(
        root.fragment,
        scopeRoot,
        false,
        null,
    );

    /**
     * @type {import("./types.js").ComponentAnalysis}
     */
    const analysis = {
        root: scopeRoot,
        elements: [],
        css: root.css
            ? {
                  hash: "zvelte-" + hash(root.css.code),
                  ast: root.css.ast,
                  keyframes: [],
              }
            : null,
        template: {
            ast: root.fragment,
            scope,
            scopes,
        },
        usesProps: options.hasJS,
        bindingGroups: new Map(),
    };

    walk(
        /** @type {import("#ast").ZvelteNode} */ (root),
        { scope, analysis, options },
        visitors,
    );

    if (analysis.css?.ast) {
        analyze_css(analysis.css.ast, analysis);

        // mark nodes as scoped/unused/empty etc
        for (const element of analysis.elements) {
            prune(analysis.css.ast, element);
        }

        outer: for (const element of analysis.elements) {
            if (element.metadata.scoped) {
                // Dynamic elements in dom mode always use spread for attributes and therefore shouldn't have a class attribute added to them
                // TODO this happens during the analysis phase, which shouldn't know anything about client vs server
                if (element.type === "ZvelteElement" && options.generate === "")
                    continue;

                /** @type {import('#ast').Attribute | undefined} */
                let class_attribute = undefined;

                for (const attribute of element.attributes) {
                    if (attribute.type === "SpreadAttribute") {
                        // The spread method appends the hash to the end of the class attribute on its own
                        continue outer;
                    }

                    if (attribute.type !== "Attribute") continue;
                    if (attribute.name.toLowerCase() !== "class") continue;

                    class_attribute = attribute;
                }

                if (class_attribute && class_attribute.value !== true) {
                    const chunks = class_attribute.value;

                    if (chunks.length === 1 && chunks[0].type === "Text") {
                        chunks[0].data += ` ${analysis.css.hash}`;
                    } else {
                        chunks.push({
                            type: "Text",
                            data: ` ${analysis.css.hash}`,
                            start: -1,
                            end: -1,
                            parent: null,
                        });
                    }
                } else {
                    element.attributes.push(
                        create_attribute("class", -1, -1, [
                            {
                                type: "Text",
                                data: analysis.css.hash,
                                parent: null,
                                start: -1,
                                end: -1,
                            },
                        ]),
                    );
                }
            }
        }
    }

    return analysis;
}

/**
 * @type {import("zimmerframe").Visitors<import("#ast").ZvelteNode, { scope: Scope, options: import("../../types.js").CompilerOptions, analysis: import("./types.js").ComponentAnalysis }>}
 */
const visitors = {
    _(node, { next }) {
        node.metadata ??= {};
        return next();
    },
    Identifier(node, { state, next }) {
        state.analysis.usesProps = true;
        return next();
    },
    ExpressionTag(node, { next }) {
        walk(
            node.expression,
            {},
            {
                Identifier() {
                    node.metadata.dynamic = true;
                },
            },
        );

        return next();
    },
    RegularElement(node, context) {
        if (context.state.options.namespace !== "foreign") {
            if (SVGElements.includes(node.name)) node.metadata.svg = true;
            else if (MathMLElements.includes(node.name))
                node.metadata.mathml = true;
        }

        determine_element_spread(node);

        // Special case: Move the children of <textarea> into a value attribute if they are dynamic
        if (
            context.state.options.namespace !== "foreign" &&
            node.name === "textarea" &&
            node.fragment.nodes.length > 0
        ) {
            if (
                node.fragment.nodes.length > 1 ||
                node.fragment.nodes[0].type !== "Text"
            ) {
                const first = node.fragment.nodes[0];
                if (first.type === "Text") {
                    // The leading newline character needs to be stripped because of a qirk:
                    // It is ignored by browsers if the tag and its contents are set through
                    // innerHTML, but we're now setting it through the value property at which
                    // point it is _not_ ignored, so we need to strip it ourselves.
                    // see https://html.spec.whatwg.org/multipage/syntax.html#element-restrictions
                    // see https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element
                    first.data = first.data.replace(
                        regex_starts_with_newline,
                        "",
                    );
                }

                node.attributes.push(
                    create_attribute(
                        "value",
                        /** @type {import('#ast').Text} */ (
                            node.fragment.nodes.at(0)
                        ).start,
                        /** @type {import('#ast').Text} */ (
                            node.fragment.nodes.at(-1)
                        ).end,
                        // @ts-ignore
                        node.fragment.nodes,
                    ),
                );

                node.fragment.nodes = [];
            }
        }

        // Special case: single expression tag child of option element -> add "fake" attribute
        // to ensure that value types are the same (else for example numbers would be strings)
        if (
            context.state.options.namespace !== "foreign" &&
            node.name === "option" &&
            node.fragment.nodes?.length === 1 &&
            node.fragment.nodes[0].type === "ExpressionTag" &&
            !node.attributes.some(
                (attribute) =>
                    attribute.type === "Attribute" &&
                    attribute.name === "value",
            )
        ) {
            const child = node.fragment.nodes[0];
            node.attributes.push(
                create_attribute("value", child.start, child.end, [child]),
            );
        }

        context.state.analysis.elements.push(node);
        context.next();
    },
    ZvelteElement(node, context) {
        context.state.analysis.elements.push(node);
        context.next();
    },
    BindDirective(node, context) {
        if (node.name !== "group") return context.next();

        // Traverse the path upwards and find all EachBlocks who are (indirectly) contributing to bind:group,
        // i.e. one of their declarations is referenced in the binding. This allows group bindings to work
        // correctly when referencing a variable declared in an EachBlock by using the index of the each block
        // entries as keys.
        let i = context.path.length;
        const each_blocks = [];
        const [keypath, expression_ids] =
            extract_all_identifiers_from_expression(node.expression);
        let ids = expression_ids;
        while (i--) {
            const parent = context.path[i];
            if (parent.type === "ForBlock") {
                const references = ids.filter((id) =>
                    parent.metadata.declarations?.has(id.name),
                );
                if (references.length > 0) {
                    parent.metadata.contains_group_binding = true;
                    for (const binding of parent.metadata.references) {
                        binding.mutated = true;
                    }
                    each_blocks.push(parent);
                    ids = ids.filter((id) => !references.includes(id));
                    ids.push(
                        ...extract_all_identifiers_from_expression(
                            parent.expression,
                        )[1],
                    );
                }
            }
        }

        // The identifiers that make up the binding expression form they key for the binding group.
        // If the same identifiers in the same order are used in another bind:group, they will be in the same group.
        // (there's an edge case where `bind:group={a[i]}` will be in a different group than `bind:group={a[j]}` even when i == j,
        // but this is a limitation of the current static analysis we do;
        const bindings = expression_ids.map((id) =>
            context.state.scope.get(id.name),
        );

        let group_name;

        outer: for (const [[key, b], group] of context.state.analysis
            .bindingGroups) {
            if (b.length !== bindings.length || key !== keypath) continue;

            for (let i = 0; i < bindings.length; i++) {
                if (bindings[i] !== b[i]) continue outer;
            }

            group_name = group;
        }

        if (!group_name) {
            group_name = context.state.scope.root.unique("binding_group");
            context.state.analysis.bindingGroups.set(
                [keypath, bindings],
                group_name,
            );
        }

        node.metadata = {
            binding_group_name: group_name,
            parent_each_blocks: each_blocks,
        };

        return context.next();
    },
};

/**
 * Extracts all identifiers and a stringified keypath from an expression.
 * @param {import('#ast').Expression} expr
 * @returns {[keypath: string, ids: import('estree').Identifier[]]}
 */
function extract_all_identifiers_from_expression(expr) {
    /** @type {import('estree').Identifier[]} */
    let nodes = [];
    /** @type {string[]} */
    let keypath = [];

    walk(
        expr,
        {},
        {
            Identifier(node, { path }) {
                const parent = path.at(-1);
                if (
                    parent?.type !== "MemberExpression" ||
                    parent.property !== node ||
                    parent.computed
                ) {
                    nodes.push(node);
                }

                if (
                    parent?.type === "MemberExpression" &&
                    parent.computed &&
                    parent.property === node
                ) {
                    keypath.push(`[${node.name}]`);
                } else {
                    keypath.push(node.name);
                }
            },
            StringLiteral: Literal,
            NullLiteral: Literal,
            BooleanLiteral: Literal,
            NumericLiteral: Literal,
        },
    );

    /**
     * @type {import("zimmerframe").Visitor<import("#ast").Literal, {}, import("#ast").Expression>}
     */
    function Literal(node, { path }) {
        const value =
            typeof node.value === "string"
                ? `"${node.value}"`
                : String(node.value);
        const parent = path.at(-1);
        if (
            parent?.type === "MemberExpression" &&
            parent.computed &&
            parent.property === node
        ) {
            keypath.push(`[${value}]`);
        } else {
            keypath.push(value);
        }
    }

    return [keypath.join("."), nodes];
}

/**
 * @param {import('#ast').RegularElement} node
 */
function determine_element_spread(node) {
    let has_spread = false;
    for (const attribute of node.attributes) {
        if (!has_spread && attribute.type === "SpreadAttribute") {
            has_spread = true;
        }
    }
    node.metadata.has_spread = has_spread;

    return node;
}
