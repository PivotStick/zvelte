import * as b from "./builders.js";
import * as e from "../errors.js";
import { JsKeywords } from "../constants.js";
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
                    initial,
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

    // /**
    // * Does partial evaluation to find an exact value or at least the rough type of the expression.
    // * Only call this once scope has been fully generated in a first pass,
    // * else this evaluates on incomplete data and may yield wrong results.
    // * @param {import("estree").Expression} expression
    // * @param {Set<any>} [values]
    // */
    //evaluate(expression, values = new Set()) {
    //	return new Evaluation(this, expression, values);
    //}
}

// class Evaluation {
// 	/** @type {Set<any>} */
// 	values;
//
// 	/**
// 	 * True if there is exactly one possible value
// 	 * @readonly
// 	 * @type {boolean}
// 	 */
// 	is_known = true;
//
// 	/**
// 	 * True if the value is known to not be null/undefined
// 	 * @readonly
// 	 * @type {boolean}
// 	 */
// 	is_defined = true;
//
// 	/**
// 	 * True if the value is known to be a string
// 	 * @readonly
// 	 * @type {boolean}
// 	 */
// 	is_string = true;
//
// 	/**
// 	 * True if the value is known to be a number
// 	 * @readonly
// 	 * @type {boolean}
// 	 */
// 	is_number = true;
//
// 	/**
// 	 * @readonly
// 	 * @type {any}
// 	 */
// 	value = undefined;
//
// 	/**
// 	 *
// 	 * @param {Scope} scope
// 	 * @param {import("estree").Expression} expression
// 	 * @param {Set<any>} values
// 	 */
// 	constructor(scope, expression, values) {
// 		this.values = values;
//
// 		switch (expression.type) {
// 			case 'Literal': {
// 				this.values.add(expression.value);
// 				break;
// 			}
//
// 			case 'Identifier': {
// 				const binding = scope.get(expression.name);
//
// 				if (binding) {
// 					if (
// 						binding.initial?.type === 'CallExpression' &&
// 						get_rune(binding.initial, scope) === '$props.id'
// 					) {
// 						this.values.add(STRING);
// 						break;
// 					}
//
// 					const is_prop =
// 						binding.kind === 'prop' ||
// 						binding.kind === 'rest_prop' ||
// 						binding.kind === 'bindable_prop';
//
// 					if (binding.initial?.type === 'EachBlock' && binding.initial.index === expression.name) {
// 						this.values.add(NUMBER);
// 						break;
// 					}
//
// 					if (!binding.updated && binding.initial !== null && !is_prop) {
// 						binding.scope.evaluate(/** @type {Expression} */ (binding.initial), this.values);
// 						break;
// 					}
// 				} else if (expression.name === 'undefined') {
// 					this.values.add(undefined);
// 					break;
// 				}
//
// 				// TODO glean what we can from reassignments
// 				// TODO one day, expose props and imports somehow
//
// 				this.values.add(UNKNOWN);
// 				break;
// 			}
//
// 			case 'BinaryExpression': {
// 				const a = scope.evaluate(/** @type {Expression} */ (expression.left)); // `left` cannot be `PrivateIdentifier` unless operator is `in`
// 				const b = scope.evaluate(expression.right);
//
// 				if (a.is_known && b.is_known) {
// 					this.values.add(binary[expression.operator](a.value, b.value));
// 					break;
// 				}
//
// 				switch (expression.operator) {
// 					case '!=':
// 					case '!==':
// 					case '<':
// 					case '<=':
// 					case '>':
// 					case '>=':
// 					case '==':
// 					case '===':
// 					case 'in':
// 					case 'instanceof':
// 						this.values.add(true);
// 						this.values.add(false);
// 						break;
//
// 					case '%':
// 					case '&':
// 					case '*':
// 					case '**':
// 					case '-':
// 					case '/':
// 					case '<<':
// 					case '>>':
// 					case '>>>':
// 					case '^':
// 					case '|':
// 						this.values.add(NUMBER);
// 						break;
//
// 					case '+':
// 						if (a.is_string || b.is_string) {
// 							this.values.add(STRING);
// 						} else if (a.is_number && b.is_number) {
// 							this.values.add(NUMBER);
// 						} else {
// 							this.values.add(STRING);
// 							this.values.add(NUMBER);
// 						}
// 						break;
//
// 					default:
// 						this.values.add(UNKNOWN);
// 				}
// 				break;
// 			}
//
// 			case 'ConditionalExpression': {
// 				const test = scope.evaluate(expression.test);
// 				const consequent = scope.evaluate(expression.consequent);
// 				const alternate = scope.evaluate(expression.alternate);
//
// 				if (test.is_known) {
// 					for (const value of (test.value ? consequent : alternate).values) {
// 						this.values.add(value);
// 					}
// 				} else {
// 					for (const value of consequent.values) {
// 						this.values.add(value);
// 					}
//
// 					for (const value of alternate.values) {
// 						this.values.add(value);
// 					}
// 				}
// 				break;
// 			}
//
// 			case 'LogicalExpression': {
// 				const a = scope.evaluate(expression.left);
// 				const b = scope.evaluate(expression.right);
//
// 				if (a.is_known) {
// 					if (b.is_known) {
// 						this.values.add(logical[expression.operator](a.value, b.value));
// 						break;
// 					}
//
// 					if (
// 						(expression.operator === '&&' && !a.value) ||
// 						(expression.operator === '||' && a.value) ||
// 						(expression.operator === '??' && a.value != null)
// 					) {
// 						this.values.add(a.value);
// 					} else {
// 						for (const value of b.values) {
// 							this.values.add(value);
// 						}
// 					}
//
// 					break;
// 				}
//
// 				for (const value of a.values) {
// 					this.values.add(value);
// 				}
//
// 				for (const value of b.values) {
// 					this.values.add(value);
// 				}
// 				break;
// 			}
//
// 			case 'UnaryExpression': {
// 				const argument = scope.evaluate(expression.argument);
//
// 				if (argument.is_known) {
// 					this.values.add(unary[expression.operator](argument.value));
// 					break;
// 				}
//
// 				switch (expression.operator) {
// 					case '!':
// 					case 'delete':
// 						this.values.add(false);
// 						this.values.add(true);
// 						break;
//
// 					case '+':
// 					case '-':
// 					case '~':
// 						this.values.add(NUMBER);
// 						break;
//
// 					case 'typeof':
// 						this.values.add(STRING);
// 						break;
//
// 					case 'void':
// 						this.values.add(undefined);
// 						break;
//
// 					default:
// 						this.values.add(UNKNOWN);
// 				}
// 				break;
// 			}
//
// 			case 'CallExpression': {
// 				const keypath = get_global_keypath(expression.callee, scope);
//
// 				if (keypath) {
// 					if (is_rune(keypath)) {
// 						const arg = /** @type {Expression | undefined} */ (expression.arguments[0]);
//
// 						switch (keypath) {
// 							case '$state':
// 							case '$state.raw':
// 							case '$derived':
// 								if (arg) {
// 									scope.evaluate(arg, this.values);
// 								} else {
// 									this.values.add(undefined);
// 								}
// 								break;
//
// 							case '$props.id':
// 								this.values.add(STRING);
// 								break;
//
// 							case '$effect.tracking':
// 								this.values.add(false);
// 								this.values.add(true);
// 								break;
//
// 							case '$derived.by':
// 								if (arg?.type === 'ArrowFunctionExpression' && arg.body.type !== 'BlockStatement') {
// 									scope.evaluate(arg.body, this.values);
// 									break;
// 								}
//
// 								this.values.add(UNKNOWN);
// 								break;
//
// 							default: {
// 								this.values.add(UNKNOWN);
// 							}
// 						}
//
// 						break;
// 					}
//
// 					if (
// 						Object.hasOwn(globals, keypath) &&
// 						expression.arguments.every((arg) => arg.type !== 'SpreadElement')
// 					) {
// 						const [type, fn] = globals[keypath];
// 						const values = expression.arguments.map((arg) => scope.evaluate(arg));
//
// 						if (fn && values.every((e) => e.is_known)) {
// 							this.values.add(fn(...values.map((e) => e.value)));
// 						} else {
// 							this.values.add(type);
// 						}
//
// 						break;
// 					}
// 				}
//
// 				this.values.add(UNKNOWN);
// 				break;
// 			}
//
// 			case 'TemplateLiteral': {
// 				let result = expression.quasis[0].value.cooked;
//
// 				for (let i = 0; i < expression.expressions.length; i += 1) {
// 					const e = scope.evaluate(expression.expressions[i]);
//
// 					if (e.is_known) {
// 						result += e.value + expression.quasis[i + 1].value.cooked;
// 					} else {
// 						this.values.add(STRING);
// 						break;
// 					}
// 				}
//
// 				this.values.add(result);
// 				break;
// 			}
//
// 			case 'MemberExpression': {
// 				const keypath = get_global_keypath(expression, scope);
//
// 				if (keypath && Object.hasOwn(global_constants, keypath)) {
// 					this.values.add(global_constants[keypath]);
// 					break;
// 				}
//
// 				this.values.add(UNKNOWN);
// 				break;
// 			}
//
// 			default: {
// 				this.values.add(UNKNOWN);
// 			}
// 		}
//
// 		for (const value of this.values) {
// 			this.value = value; // saves having special logic for `size === 1`
//
// 			if (value !== STRING && typeof value !== 'string') {
// 				this.is_string = false;
// 			}
//
// 			if (value !== NUMBER && typeof value !== 'number') {
// 				this.is_number = false;
// 			}
//
// 			if (value == null || value === UNKNOWN) {
// 				this.is_defined = false;
// 			}
// 		}
//
// 		if (this.values.size > 1 || typeof this.value === 'symbol') {
// 			this.is_known = false;
// 		}
// 	}
// }

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
 * @typedef {{ scope: Scope }} State
 *
 * @param {import('#ast').ZvelteNode} ast
 * @param {ScopeRoot} root
 * @param {boolean} allow_reactive_declarations
 * @param {Scope | null} parent
 */
export function createScopes(ast, root, allow_reactive_declarations, parent) {
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

        Component: (node, context) => {
            context.state.scope.reference(b.id(node.name), context.path);
            Component(node, context);
        },
        ZvelteSelf: Component,
        ZvelteComponent: Component,

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
 * @param {import('#ast').Component | import("#ast").ZvelteSelf | import("#ast").ZvelteComponent} node
 * @param {import("zimmerframe").Context<import('#ast').ZvelteNode, State>} context
 */
const Component = (node, context) => {
    node.metadata.scopes = {
        default: context.state.scope.child(),
    };

    const default_state = { scope: node.metadata.scopes.default };

    for (const attribute of node.attributes) {
        context.visit(attribute);
    }

    for (const child of node.fragment.nodes) {
        let state = default_state;
        context.visit(child, state);
    }
};

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
                    : state,
            );
        },
    };
}
