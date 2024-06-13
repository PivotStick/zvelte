import * as b from "./builders.js";
import * as e from "../errors.js";
import { JsKeywords } from "./constants.js";
import { walk } from "zimmerframe";

export class Scope {
    /** @type {ScopeRoot} */
    root;

    /**
     * The immediate parent scope
     * @type {Scope | null}
     */
    parent;

    /**
     * Whether or not `var` declarations are contained by this scope
     * @type {boolean}
     */
    #porous;

    /**
     * A map of every identifier declared by this scope, and all the
     * identifiers that reference it
     * @type {Map<string, any>}
     */
    declarations = new Map();

    /**
     * A map of declarators to the bindings they declare
     * @type {Map<import('estree').VariableDeclarator, any[]>}
     */
    declarators = new Map();

    /**
     * A set of all the names referenced with this scope
     * — useful for generating unique names
     * @type {Map<string, { node: import('estree').Identifier; path: import('#ast').ZvelteNode[] }[]>}
     */
    references = new Map();

    /**
     * The scope depth allows us to determine if a state variable is referenced in its own scope,
     * which is usually an error. Block statements do not increase this value
     */
    function_depth = 0;

    /**
     *
     * @param {ScopeRoot} root
     * @param {Scope | null} parent
     * @param {boolean} porous
     */
    constructor(root, parent, porous) {
        this.root = root;
        this.parent = parent;
        this.#porous = porous;
        this.function_depth = parent
            ? parent.function_depth + (porous ? 0 : 1)
            : 0;
    }

    /**
     * @param {import('estree').Identifier} node
     * @param {unknown} kind
     * @param {unknown} declaration_kind
     * @param {null | import('estree').Expression | import('estree').FunctionDeclaration | import('estree').ClassDeclaration | import('estree').ImportDeclaration | import('../types/template.js').EachBlock} initial
     * @returns {unknown}
     */
    declare(node, kind, declaration_kind, initial = null) {
        if (node.name === "$") {
            e.dollar_binding_invalid(node);
        }

        if (
            node.name.startsWith("$") &&
            declaration_kind !== "synthetic" &&
            declaration_kind !== "param" &&
            declaration_kind !== "rest_param" &&
            this.function_depth <= 1
        ) {
            e.dollar_prefix_invalid(node);
        }

        if (this.parent) {
            if (declaration_kind === "var" && this.#porous) {
                return this.parent.declare(node, kind, declaration_kind);
            }

            if (declaration_kind === "import") {
                return this.parent.declare(
                    node,
                    kind,
                    declaration_kind,
                    initial
                );
            }
        }

        if (this.declarations.has(node.name)) {
            // This also errors on var/function types, but that's arguably a good thing
            e.declaration_duplicate(node, node.name);
        }

        /** @type {unknown} */
        const binding = {
            node,
            references: [],
            legacy_dependencies: [],
            initial,
            mutated: false,
            scope: this,
            kind,
            declaration_kind,
            is_called: false,
            prop_alias: null,
            expression: null,
            mutation: null,
            reassigned: false,
            metadata: null,
        };
        this.declarations.set(node.name, binding);
        this.root.conflicts.add(node.name);
        return binding;
    }

    child(porous = false) {
        return new Scope(this.root, this, porous);
    }

    /**
     * @param {string} preferred_name
     * @returns {string}
     */
    generate(preferred_name) {
        if (this.#porous) {
            return /** @type {Scope} */ (this.parent).generate(preferred_name);
        }

        preferred_name = preferred_name
            .replace(/[^a-zA-Z0-9_$]/g, "_")
            .replace(/^[0-9]/, "_");
        let name = preferred_name;
        let n = 1;

        while (
            this.references.has(name) ||
            this.declarations.has(name) ||
            this.root.conflicts.has(name) ||
            JsKeywords.includes(name)
        ) {
            name = `${preferred_name}_${n++}`;
        }

        this.references.set(name, []);
        this.root.conflicts.add(name);
        return name;
    }

    /**
     * @param {string} name
     * @returns {unknown | null}
     */
    get(name) {
        return this.declarations.get(name) ?? this.parent?.get(name) ?? null;
    }

    /**
     * @param {import('estree').VariableDeclarator} node
     * @returns {unknown[]}
     */
    get_bindings(node) {
        const bindings = this.declarators.get(node);
        if (!bindings) {
            throw new Error("No binding found for declarator");
        }
        return bindings;
    }

    /**
     * @param {string} name
     * @returns {Scope | null}
     */
    owner(name) {
        return this.declarations.has(name)
            ? this
            : this.parent && this.parent.owner(name);
    }

    /**
     * @param {import('estree').Identifier | import("#ast").Identifier} node
     * @param {import('#ast').ZvelteNode[]} path
     */
    reference(node, path) {
        path = [...path]; // ensure that mutations to path afterwards don't affect this reference
        let references = this.references.get(node.name);

        if (!references) this.references.set(node.name, (references = []));

        references.push({ node, path });

        const binding = this.declarations.get(node.name);
        if (binding) {
            binding.references.push({ node, path });
        } else if (this.parent) {
            this.parent.reference(node, path);
        } else {
            // no binding was found, and this is the top level scope,
            // which means this is a global
            this.root.conflicts.add(node.name);
        }
    }
}

export class ScopeRoot {
    /** @type {Set<string>} */
    conflicts = new Set();

    /**
     * @param {string} preferred_name
     */
    unique(preferred_name) {
        preferred_name = preferred_name.replace(/[^a-zA-Z0-9_$]/g, "_");
        let final_name = preferred_name;
        let n = 1;

        while (this.conflicts.has(final_name)) {
            final_name = `${preferred_name}_${n++}`;
        }

        this.conflicts.add(final_name);
        const id = b.id(final_name);
        return id;
    }
}

/**
 * @param {import('#ast').ZvelteNode} ast
 * @param {ScopeRoot} root
 * @param {boolean} allow_reactive_declarations
 * @param {Scope | null} parent
 */
export function createScopes(ast, root, allow_reactive_declarations, parent) {
    /** @typedef {{ scope: Scope }} State */

    /**
     * A map of node->associated scope. A node appearing in this map does not necessarily mean that it created a scope
     * @type {Map<import('#ast').ZvelteNode, Scope>}
     */
    const scopes = new Map();
    const scope = new Scope(root, parent, false);
    scopes.set(ast, scope);

    /**
     * @type {import('zimmerframe').Visitor<import('#ast').ElementLike, State, import('#ast').ZvelteNode>}
     */
    const ZvelteFragment = (node, { state, next }) => {
        const scope = state.scope.child();
        scopes.set(node, scope);
        next({ scope });
    };

    /** @type {State} */
    const state = { scope };

    /**
     * @type {[Scope, { node: import('#ast').Identifier; path: import('#ast').ZvelteNode[] }][]}
     */
    const references = [];

    /**
     * An array of reactive declarations, i.e. the `a` in `$: a = b * 2`
     * @type {import('estree').Identifier[]}
     */
    const possible_implicit_declarations = [];

    walk(ast, state, {
        _(node, { next }) {
            node.metadata ??= {};
            next();
        },

        // references
        Identifier(node, { path, state }) {
            references.push([
                state.scope,
                {
                    node,
                    path: path.slice(),
                },
            ]);
        },

        RegularElement: ZvelteFragment,

        Fragment: (node, context) => {
            const scope = context.state.scope.child(node.transparent);
            scopes.set(node, scope);
            context.next({ scope });
        },
    });

    for (const id of possible_implicit_declarations) {
        const binding = scope.get(id.name);
        if (binding) continue; // TODO can also be legacy_reactive if declared outside of reactive statement

        scope.declare(id, "legacy_reactive", "let");
    }

    // we do this after the fact, so that we don't need to worry
    // about encountering references before their declarations
    for (const [scope, { node, path }] of references) {
        scope.reference(node, path);
    }

    return {
        scope,
        scopes,
    };
}

/**
 * @template {{ scope: Scope }} State
 * @param {Map<import('#ast').ZvelteNode, Scope>} scopes
 * @returns {import('zimmerframe').Visitors<import('#ast').ZvelteNode, State>}
 */
export function setScope(scopes) {
    return {
        /**
         *
         * @param {import('#ast').ZvelteNode} node
         * @param {import('zimmerframe').Context<import('#ast').ZvelteNode, State>} context
         */
        _(node, { next, state }) {
            const scope = scopes.get(node);
            next(
                scope !== undefined && scope !== state.scope
                    ? { ...state, scope }
                    : state
            );
        },
    };
}
