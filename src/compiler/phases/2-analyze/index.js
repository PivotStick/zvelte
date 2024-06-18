import { walk } from "zimmerframe";
import { hash } from "../../utils/hash.js";
import {
    Scope,
    ScopeRoot,
    createScopes,
} from "../3-transform/render_dom/scope.js";

/**
 * @param {import("#ast").Root} root
 */
export function analyseComponent(root) {
    const scopeRoot = new ScopeRoot();

    const { scope, scopes } = createScopes(
        root.fragment,
        scopeRoot,
        false,
        null
    );

    /**
     * @type {import("./types.js").ComponentAnalysis}
     */
    const analysis = {
        root: scopeRoot,
        css: root.css
            ? {
                  hash: "zvelte-" + hash(root.css.code),
                  ast: root.css.ast,
                  code: root.css.code,
              }
            : null,
        template: {
            ast: root.fragment,
            scope,
            scopes,
        },
        bindingGroups: new Map(),
    };

    walk(
        /** @type {import("#ast").ZvelteNode} */ (root),
        { scope, analysis },
        visitors
    );

    return analysis;
}

/**
 * @type {import("zimmerframe").Visitors<import("#ast").ZvelteNode, { scope: Scope, analysis: import("./types.js").ComponentAnalysis }>}
 */
const visitors = {
    _(node, { next }) {
        node.metadata ??= {};
        return next();
    },
    BindDirective(node, context) {
        if (node.name !== "group") return;

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
                    parent.metadata.declarations?.has(id.name)
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
                            parent.expression
                        )[1]
                    );
                }
            }
        }

        // The identifiers that make up the binding expression form they key for the binding group.
        // If the same identifiers in the same order are used in another bind:group, they will be in the same group.
        // (there's an edge case where `bind:group={a[i]}` will be in a different group than `bind:group={a[j]}` even when i == j,
        // but this is a limitation of the current static analysis we do;
        const bindings = expression_ids.map((id) =>
            context.state.scope.get(id.name)
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
                group_name
            );
        }

        node.metadata = {
            binding_group_name: group_name,
            parent_each_blocks: each_blocks,
        };
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
        }
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
