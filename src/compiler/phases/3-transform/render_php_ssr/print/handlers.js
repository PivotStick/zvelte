/**
 * Does `array.push` for all `items`. Needed because `array.push(...items)` throws
 * "Maximum call stack size exceeded" when `items` is too big of an array.
 *
 * @param {any[]} array
 * @param {any[]} items
 */
function push_array(array, items) {
    for (let i = 0; i < items.length; i++) {
        array.push(items[i]);
    }
}

/**
 * @typedef {{
 *   content: string;
 *   loc?: {
 *     start: { line: number; column: number; };
 *     end: { line: number; column: number; };
 *   };
 *   has_newline: boolean;
 * }} Chunk
 *
 * @typedef {(node: any, state: State) => Chunk[]} Handler
 *
 * @typedef {{
 *   indent: string;
 *   getName: (name: string) => string;
 *   scope: null;
 * }} State
 */

/**
 * @param {(node: any, state: State) => Chunk[]} fn
 */
const scoped = (fn) => {
    /**
     * @param {any} node
     * @param {State} state
     */
    const scoped_fn = (node, state) => {
        return fn(node, {
            ...state,
            scope: null,
        });
    };

    return scoped_fn;
};

/**
 * @param {import("../type.js").Node} node
 * @param {State} state
 *
 * @returns {Chunk[]}
 */
export function handle(node, state) {
    const handler = handlers[node?.kind];

    if (!handler) {
        if (!node?.kind) {
            console.error("----->", node);
            throw new Error(`Cannot handle ${node?.constructor ?? node}`);
        }
        throw new Error(`Not implemented ${node.kind}`);
    }

    return handler(node, state);
}

/** @type {Record<string, Handler>} */
const handlers = {
    program(node, state) {
        const chunks = [c("<?php\n\n")];

        push_array(chunks, handle_body(node.children, state));

        return chunks;
    },

    block: scoped((node, state) => {
        return [
            c(`\n${state.indent}{\n${state.indent}\t`),
            ...handle_body(node.body ?? node.children, {
                ...state,
                indent: state.indent + "\t",
            }),
            c(`\n${state.indent}}`),
        ];
    }),

    expressionstatement(node, state) {
        return [...handle(node.expression, state), c(";")];
    },

    assign(node, state) {
        return [
            ...handle(node.left, state),
            c(` ${node.operator || "="} `),
            ...handle(node.right, state),
        ];
    },

    variable(node, state) {
        const chunks = [];
        if (node.byref) {
            chunks.push(c("&"));
        }
        chunks.push(c(`$${node.name}`));
        return chunks;
    },

    string(node, state) {
        if (!node.value && node.raw) {
            return [c(node.raw)];
        }

        const q = node.isDoubleQuote ? '"' : "'";

        return [c(`${q}${node.value}${q}`)];
    },

    nullkeyword(node, state) {
        return [c(`${node.raw}`)];
    },

    boolean(node, state) {
        return [c(`${node.raw}`)];
    },

    number(node, state) {
        return [c(`${node.value}`)];
    },

    silent(node, state) {
        return [c("@"), ...handle(node.expr, state)];
    },

    class(node, state) {
        const chunks = [c("class ")];

        if (node.name) {
            push_array(chunks, handle(node.name, state));
            chunks.push(c(" "));
        }

        if (node.extends) {
            chunks.push(c("extends "));
            push_array(chunks, handle(node.extends, state));
            chunks.push(c(" "));
        }

        push_array(chunks, handlers.block(node, state));

        return chunks;
    },

    identifier(node, state) {
        return [c(`${node.name}`)];
    },

    name(node, state) {
        return [c(node.name)];
    },

    method(node, state) {
        const chunks = [];

        if (node.isFinal) {
            chunks.push(c("final "));
        }

        if (node.visibility) {
            chunks.push(c(`${node.visibility} `));
        }

        if (node.isStatic) {
            chunks.push(c("static "));
        }

        chunks.push(c("function "));
        push_array(chunks, handle(node.name, state));

        chunks.push(c("("));

        for (let i = 0; i < node.arguments.length; i += 1) {
            push_array(chunks, handle(node.arguments[i], state));
            if (i < node.arguments.length - 1) chunks.push(c(", "));
        }

        chunks.push(c(")"));

        if (node.type) {
            chunks.push(c(": "));
            push_array(chunks, handle(node.type, state));
        }

        push_array(chunks, handle(node.body, state));

        return chunks;
    },

    parameter(node, state) {
        const chunks = [];

        if (node.type) {
            if (node.nullable) {
                chunks.push(c("?"));
            }

            push_array(chunks, handle(node.type, state));
            chunks.push(c(" "));
        }

        if (node.byref) {
            chunks.push(c("&"));
        }

        chunks.push(c("$"));
        push_array(chunks, handle(node.name, state));

        if (node.value) {
            chunks.push(c(" = "));
            push_array(chunks, handle(node.value, state));
        }

        return chunks;
    },

    typereference(node, state) {
        return [c(node.raw)];
    },

    return(node, state) {
        if (node.expr) {
            return [c("return "), ...handle(node.expr, state), c(";")];
        }

        return [c("return;")];
    },

    bin(node, state) {
        /**
         * @type any[]
         */
        const chunks = [];

        if (needs_parens(node.left, node, false)) {
            chunks.push(c("("));
            push_array(chunks, handle(node.left, state));
            chunks.push(c(")"));
        } else {
            push_array(chunks, handle(node.left, state));
        }

        chunks.push(c(` ${node.type} `));

        if (needs_parens(node.right, node, true)) {
            chunks.push(c("("));
            push_array(chunks, handle(node.right, state));
            chunks.push(c(")"));
        } else {
            push_array(chunks, handle(node.right, state));
        }

        return chunks;
    },

    namespace(node, state) {
        const chunks = [c("namespace "), c(node.name), c(";\n\n")];

        push_array(chunks, handle_body(node.children, state));

        return chunks;
    },

    if(node, state) {
        const chunks = [
            c("if ("),
            ...handle(node.test, state),
            c(") "),
            ...handle(node.body, state),
        ];

        if (node.alternate) {
            chunks.push(c(`\n${state.indent}else`));
            push_array(chunks, handle(node.alternate, state));
        }

        return chunks;
    },

    propertylookup(node, state) {
        const what = handle(node.what, state);

        if (
            node.what.kind !== "variable" &&
            node.what.kind !== "identifier" &&
            node.what.kind !== "propertylookup"
        ) {
            what.unshift(c("("));
            what.push(c(")"));
        }

        const arrow = node.optional ? c("?->") : c("->");

        return [...what, arrow, ...handle(node.offset, state)];
    },

    propertystatement(node, state) {
        const chunks = [];

        if (node.visibility) {
            chunks.push(c(node.visibility + " "));
        }

        if (node.isStatic) {
            chunks.push(c("static "));
        }

        for (let i = 0; i < node.properties.length; i++) {
            const n = node.properties[i];
            push_array(chunks, handle(n, state));
            if (i !== node.properties.length - 1) {
                chunks.push(c(", "));
            }
        }

        chunks.push(c(";"));

        return chunks;
    },

    property(node, state) {
        const chunks = [];

        if (node.type) {
            if (node.nullable) {
                chunks.push(c("?"));
            }

            push_array(chunks, [...handle(node.type, state), c(" ")]);
        }

        chunks.push(c("$"));
        push_array(chunks, handle(node.name, state));

        return chunks;
    },

    call(node, state) {
        const chunks = [];

        if (node.wrap === true) {
            chunks.push(c("("), ...handle(node.what, state), c(")"));
        } else {
            chunks.push(...handle(node.what, state));
        }

        chunks.push(c("("));

        node.arguments.forEach(
            (/** @type {import("php-parser").Node} */ arg, i, arr) => {
                push_array(chunks, handle(arg, state));
                if (i < arr.length - 1) {
                    chunks.push(c(", "));
                }
            },
        );

        chunks.push(c(")"));

        return chunks;
    },

    encapsed(node, state) {
        const chunks = [c('"')];

        node.value.forEach((/** @type {import("php-parser").Node} */ part) => {
            push_array(chunks, handle(part, state));
        });

        chunks.push(c('"'));

        return chunks;
    },

    encapsedpart(node, state) {
        const chunks = [];

        if (node.curly) {
            chunks.push(c("{"));
            push_array(chunks, handle(node.expression, state));
            chunks.push(c("}"));
        } else {
            chunks.push(c(node.expression.raw));
        }

        return chunks;
    },

    usegroup(node, state) {
        const chunks = [];

        if (node.name) {
            chunks.push(c(`use ${node.name}\\`));
            if (node.items.length > 1) chunks.push(c("{"));

            node.items.forEach((item, i, arr) => {
                push_array(chunks, handle(item, state));
                if (i < arr.length - 1) {
                    chunks.push(c(", "));
                }
            });

            if (node.items.length > 1) chunks.push(c("}"));
        }

        chunks.push(c(";"));

        return chunks;
    },

    useitem(node, state) {
        return [c(node.name)];
    },

    selfreference(node, state) {
        return [c(node.raw)];
    },

    retif(node, state) {
        const chunks = [...handle(node.test, state), c(" ? ")];

        if (node.trueExpr.kind === "retif") {
            chunks.push(c("("));
            push_array(chunks, handle(node.trueExpr, state));
            chunks.push(c(")"));
        } else {
            push_array(chunks, handle(node.trueExpr, state));
        }

        chunks.push(c(" : "));

        if (node.falseExpr.kind === "retif") {
            chunks.push(c("("));
            push_array(chunks, handle(node.falseExpr, state));
            chunks.push(c(")"));
        } else {
            push_array(chunks, handle(node.falseExpr, state));
        }

        return chunks;
    },

    new(node, state) {
        const chunks = [c("new "), ...handle(node.what, state), c("(")];

        for (let i = 0; i < node.arguments.length; i++) {
            const arg = node.arguments[i];
            chunks.push(...handle(arg, state));

            if (i < node.arguments.length - 1) {
                chunks.push(c(", "));
            }
        }

        chunks.push(c(")"));

        return chunks;
    },

    foreach(node, state) {
        const chunks = [
            c("foreach ("),
            ...handle(node.source, state),
            c(" as "),
        ];

        if (node.key) {
            push_array(chunks, handle(node.key, state));
            chunks.push(c(" => "));
        }

        push_array(chunks, handle(node.value, state));
        chunks.push(c(")"));
        push_array(chunks, handle(node.body, state));

        return chunks;
    },

    post(node, state) {
        return [...handle(node.what, state), c(node.type.repeat(2))];
    },

    pre(node, state) {
        return [c(node.type.repeat(2)), ...handle(node.what, state)];
    },

    cast(node, state) {
        return [c("("), c(node.type), c(")"), ...handle(node.expr, state)];
    },

    array(node, state) {
        const indent = `${state.indent}\t`;
        const chunks = [c("[")];

        if (node.items.length) {
            chunks.push(c(`\n${indent}`));
        }

        node.items.forEach(
            (/** @type {import("php-parser").Node} */ entry, i, arr) => {
                push_array(
                    chunks,
                    handle(entry, {
                        ...state,
                        indent,
                    }),
                );

                const last = i === arr.length - 1;

                chunks.push(c(`,\n${last ? indent.slice(1) : indent}`));
            },
        );

        chunks.push(c("]"));
        return chunks;
    },

    entry(node, state) {
        const chunks = [];

        if (node.unpack) {
            chunks.push(c("..."), ...handle(node.value, state));
        } else if (node.key) {
            push_array(chunks, [
                ...handle(node.key, state),
                c(" => "),
                ...handle(node.value, state),
            ]);
        } else {
            push_array(chunks, handle(node.value, state));
        }

        return chunks;
    },

    offsetlookup(node, state) {
        const chunks = [...handle(node.what, state), c("[")];

        if (node.offset) {
            push_array(chunks, handle(node.offset, state));
        }

        chunks.push(c("]"));

        return chunks;
    },

    empty(node, state) {
        return [c("empty("), ...handle(node.expression, state), c(")")];
    },

    isset(node, state) {
        const chunks = [c("isset(")];

        node.variables.forEach((variable, i) => {
            chunks.push(...handle(variable, state));
            if (i < node.variables.length - 1) {
                chunks.push(c(", "));
            }
        });

        chunks.push(c(")"));

        return chunks;
    },

    staticlookup(node, state) {
        return [
            ...handle(node.what, state),
            c("::"),
            ...handle(node.offset, state),
        ];
    },

    unary(node, state) {
        const chunks = [c(node.type)];

        if (node.wrap === true) {
            chunks.push(c("("), ...handle(node.what, state), c(")"));
        } else {
            chunks.push(...handle(node.what, state));
        }

        return chunks;
    },

    closure(node, state) {
        const chunks = [];
        if (node.isStatic) {
            chunks.push(c("static "));
        }
        chunks.push(c("function("));
        node.arguments.forEach((arg, i, arr) => {
            chunks.push(...handle(arg, state));
            if (i < arr.length - 1) chunks.push(c(", "));
        });
        chunks.push(c(")"));

        if (node.uses?.length) {
            chunks.push(c(" use ("));
            node.uses.forEach((variable, i, arr) => {
                chunks.push(...handle(variable, state));
                if (i < arr.length - 1) chunks.push(c(", "));
            });
            chunks.push(c(")"));
        }

        if (node.type) {
            chunks.push(c(": "));
            chunks.push(...handle(node.type, state));
        }

        chunks.push(...handle(node.body, state));
        return chunks;
    },

    arrowfunc(node, state) {
        const chunks = [];

        if (node.isStatic) {
            chunks.push(c("static "));
        }

        chunks.push(c("fn("));
        for (let i = 0; i < node.arguments.length; i++) {
            const arg = node.arguments[i];
            chunks.push(...handle(arg, state));

            if (i < node.arguments.length - 1) {
                chunks.push(c(", "));
            }
        }
        chunks.push(c(") => "));
        chunks.push(...handle(node.body, state));

        return chunks;
    },
};

/**
 * @param {import("../type.js").Node[]} nodes
 * @param {State} state
 */
const handle_body = (nodes, state) => {
    const chunks = [];

    const body = nodes.map((statement) => {
        const chunks = handle(statement, {
            ...state,
            indent: state.indent,
        });

        return chunks;
    });

    let needed_padding = false;

    for (let i = 0; i < body.length; i += 1) {
        const needs_padding = has_newline(body[i]);

        if (i > 0) {
            chunks.push(
                c(
                    needs_padding || needed_padding
                        ? `\n\n${state.indent}`
                        : `\n${state.indent}`,
                ),
            );
        }

        push_array(chunks, body[i]);

        needed_padding = needs_padding;
    }

    return chunks;
};

/**
 * @param {string} content
 * @param {import("../type.js").Node} [node]
 * @returns {Chunk}
 */
function c(content, node) {
    return {
        content,
        loc: node && node.loc,
        has_newline: /\n/.test(content),
    };
}

/** @param {Chunk[]} chunks */
const has_newline = (chunks) => {
    for (let i = 0; i < chunks.length; i += 1) {
        if (chunks[i].has_newline) return true;
    }
    return false;
};

const OPERATOR_PRECEDENCE = {
    "||": 2,
    "&&": 3,
    "??": 4,
    "|": 5,
    "^": 6,
    "&": 7,
    "==": 8,
    "!=": 8,
    "===": 8,
    "!==": 8,
    "<": 9,
    ">": 9,
    "<=": 9,
    ">=": 9,
    "<<": 10,
    ">>": 10,
    ">>>": 10,
    "+": 11,
    "-": 11,
    "*": 12,
    "%": 12,
    "/": 12,
    "**": 13,
};

/** @type {Record<string, number>} */
const EXPRESSIONS_PRECEDENCE = {
    ArrayExpression: 20,
    TaggedTemplateExpression: 20,
    ThisExpression: 20,

    identifier: 20,

    Literal: 18,
    TemplateLiteral: 20,
    Super: 20,
    SequenceExpression: 20,
    MemberExpression: 19,
    CallExpression: 19,
    NewExpression: 19,
    AwaitExpression: 17,
    ClassExpression: 17,
    FunctionExpression: 17,
    ObjectExpression: 17,
    UpdateExpression: 16,
    UnaryExpression: 15,

    bin: 14,
    retif: 13,

    ConditionalExpression: 4,
    ArrowFunctionExpression: 3,
    AssignmentExpression: 3,
    YieldExpression: 2,
    RestElement: 1,
};

/**
 * @param {any} node
 * @param {any} parent
 * @param {boolean} is_right
 *
 * @returns
 */
function needs_parens(node, parent, is_right) {
    // special case where logical expressions and coalesce expressions cannot be mixed,
    // either of them need to be wrapped with parentheses
    if (node.kind === "retif") {
        return true;
    }

    const precedence = EXPRESSIONS_PRECEDENCE[node.type];
    const parent_precedence = EXPRESSIONS_PRECEDENCE[parent.type];

    if (precedence !== parent_precedence) {
        // Different node types
        return (
            (!is_right &&
                precedence === 15 &&
                parent_precedence === 14 &&
                parent.operator === "**") ||
            precedence < parent_precedence
        );
    }

    if (precedence !== 13 && precedence !== 14) {
        // Not a `LogicalExpression` or `BinaryExpression`
        return false;
    }

    if (node.operator === "**" && parent.operator === "**") {
        // Exponentiation operator has right-to-left associativity
        return !is_right;
    }

    if (is_right) {
        // Parenthesis are used if both operators have the same precedence
        return (
            OPERATOR_PRECEDENCE[node.operator] <=
            OPERATOR_PRECEDENCE[parent.operator]
        );
    }

    return (
        OPERATOR_PRECEDENCE[node.operator] <
        OPERATOR_PRECEDENCE[parent.operator]
    );
}
