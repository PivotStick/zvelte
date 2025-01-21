/** @import * as PHP from "../types.d.ts" */

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
 * @param {PHP.Node} node
 * @param {State} state
 *
 * @returns {Chunk[]}
 */
export function handle(node, state) {
    const handler = handlers[node?.kind];

    if (!handler) {
        if (!node?.kind) {
            console.error("----->", node);
            // @ts-ignore
            throw new Error(`Cannot handle ${node?.constructor ?? node}`);
        }
        throw new Error(`"${node.kind}" node is not yet implemented`);
    }

    return handler(node, state);
}

/** @type {Record<string, Handler>} */
const handlers = {
    /**
     * @param {PHP.Program} node
     */
    program(node, state) {
        const chunks = [c("<?php\n\n")];

        push_array(chunks, handle_body(node.children, state));

        return chunks;
    },

    block: scoped((node, state) => {
        const body = node.body ?? node.children;
        if (!body.length) {
            return [c(" {}")];
        }

        return [
            c(`\n${state.indent}{\n${state.indent}\t`),
            ...handle_body(body, {
                ...state,
                indent: state.indent + "\t",
            }),
            c(`\n${state.indent}}`),
        ];
    }),

    /**
     * @param {PHP.ExpressionStatement} node
     */
    expressionstatement(node, state) {
        return [...handle(node.expression, state), c(";")];
    },

    /**
     * @param {PHP.Assign} node
     */
    assign(node, state) {
        return [
            ...handle(node.left, state),
            c(` ${node.operator || "="} `),
            ...handle(node.right, state),
        ];
    },

    /**
     * @param {PHP.Variable} node
     */
    variable(node, state) {
        const chunks = [];
        if (node.byref) {
            chunks.push(c("&"));
        }
        chunks.push(c(`$${node.name}`));
        return chunks;
    },

    /**
     * @param {PHP.StringLiteral} node
     */
    string(node, state) {
        if (!node.value && node.raw) {
            return [c(node.raw)];
        }

        const q = node.isDoubleQuote ? '"' : "'";

        return [c(`${q}${node.value}${q}`)];
    },

    /**
     * @param {PHP.NullKeyword} node
     */
    nullkeyword(node, state) {
        return [c(`${node.raw}`)];
    },

    /**
     * @param {PHP.BooleanLiteral} node
     */
    boolean(node, state) {
        return [c(`${node.raw}`)];
    },

    /**
     * @param {PHP.NumberLiteral} node
     */
    number(node, state) {
        return [c(`${node.value}`)];
    },

    /**
     * @param {PHP.Silent} node
     */
    silent(node, state) {
        return [c("@"), ...handle(node.expr, state)];
    },

    /**
     * @param {PHP.Class} node
     */
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

    /**
     * @param {PHP.Identifier} node
     */
    identifier(node, state) {
        return [c(`${node.name}`)];
    },

    /**
     * @param {PHP.Name} node
     */
    name(node, state) {
        return [c(node.name)];
    },

    /**
     * @param {PHP.Method} node
     */
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

    /**
     * @param {PHP.Parameter} node
     */
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

    /**
     * @param {PHP.TypeReference} node
     */
    typereference(node, state) {
        return [c(node.raw)];
    },

    /**
     * @param {PHP.Return} node
     */
    return(node, state) {
        if (node.expr) {
            return [c("return "), ...handle(node.expr, state), c(";")];
        }

        return [c("return;")];
    },

    /**
     * @param {PHP.Bin} node
     */
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

    /**
     * @param {PHP.Namespace} node
     */
    namespace(node, state) {
        const chunks = [c("namespace "), c(node.name), c(";\n\n")];

        push_array(chunks, handle_body(node.children, state));

        return chunks;
    },

    /**
     * @param {PHP.If} node
     */
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

    /**
     * @param {PHP.PropertyLookup} node
     */
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

    // /**
    //  * ?? what the flip is this unused stuff?
    //  *
    //  * @param {PHP.PropertyStatement} node
    //  */
    // propertystatement(node, state) {
    //     const chunks = [];
    //
    //     if (node.visibility) {
    //         chunks.push(c(node.visibility + " "));
    //     }
    //
    //     if (node.isStatic) {
    //         chunks.push(c("static "));
    //     }
    //
    //     for (let i = 0; i < node.properties.length; i++) {
    //         const n = node.properties[i];
    //         push_array(chunks, handle(n, state));
    //         if (i !== node.properties.length - 1) {
    //             chunks.push(c(", "));
    //         }
    //     }
    //
    //     chunks.push(c(";"));
    //
    //     return chunks;
    // },
    //
    // /**
    //  * ?? same here
    //  *
    //  * @param {PHP.Property} node
    //  */
    // property(node, state) {
    //     const chunks = [];
    //
    //     if (node.type) {
    //         if (node.nullable) {
    //             chunks.push(c("?"));
    //         }
    //
    //         push_array(chunks, [...handle(node.type, state), c(" ")]);
    //     }
    //
    //     chunks.push(c("$"));
    //     push_array(chunks, handle(node.name, state));
    //
    //     return chunks;
    // },

    /**
     * @param {PHP.Call} node
     */
    call(node, state) {
        /** @type {Chunk[]} */
        const chunks = [];

        if (node.wrap === true) {
            chunks.push(c("("), ...handle(node.what, state), c(")"));
        } else {
            chunks.push(...handle(node.what, state));
        }

        chunks.push(c("("));

        for (let i = 0; i < node.arguments.length; i++) {
            const arg = node.arguments[i];

            push_array(chunks, handle(arg, state));
            if (i < node.arguments.length - 1) {
                chunks.push(c(", "));
            }
        }

        chunks.push(c(")"));

        return chunks;
    },

    /**
     * @param {PHP.Encapsed} node
     */
    encapsed(node, state) {
        const chunks = [c('"')];

        for (let i = 0; i < node.value.length; i++) {
            const part = node.value[i];

            push_array(chunks, handle(part, state));
        }

        chunks.push(c('"'));

        return chunks;
    },

    /**
     * @param {PHP.EncapsedPart} node
     */
    encapsedpart(node, state) {
        /** @type {Chunk[]} */
        const chunks = [];

        if (node.curly) {
            chunks.push(c("{"));
            push_array(chunks, handle(node.expression, state));
            chunks.push(c("}"));
        } else {
            push_array(chunks, handle(node.expression, state));
        }

        return chunks;
    },

    /**
     * @param {PHP.UseGroup} node
     */
    usegroup(node, state) {
        const chunks = [c("use ")];

        if (node.name) {
            chunks.push(c(node.name));

            if (node.items.length) {
                chunks.push(c("\\"));
            }
        }

        if (node.items.length > 1) chunks.push(c("{"));

        node.items.forEach((item, i, arr) => {
            push_array(chunks, handle(item, state));
            if (i < arr.length - 1) {
                chunks.push(c(", "));
            }
        });

        if (node.items.length > 1) chunks.push(c("}"));

        chunks.push(c(";"));

        return chunks;
    },

    /**
     * @param {PHP.UseItem} node
     */
    useitem(node, state) {
        const chunks = [c(node.name)];

        if (node.alias) {
            chunks.push(c(" as "), ...handle(node.alias, state));
        }

        return chunks;
    },

    // /**
    //  * ?? another one
    //  *
    //  * @param {PHP.SelfReference} node
    //  */
    // selfreference(node, state) {
    //     return [c(node.raw)];
    // },

    /**
     * @param {PHP.RetIf} node
     */
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

    /**
     * @param {PHP.New} node
     */
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

    /**
     * @param {PHP.ForEach} node
     */
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

    /**
     * @param {PHP.For} node
     */
    for(node, state) {
        const chunks = [c("for (")];

        /**
         * @param {PHP.Expression[]} arr
         */
        function add(arr = []) {
            for (let i = 0; i < arr.length; i++) {
                const n = arr[i];

                push_array(chunks, handle(n, state));

                if (chunks[chunks.length - 1].content === ";") {
                    chunks.pop();
                }

                if (i !== arr.length - 1) {
                    chunks.push(c(", "));
                }
            }
        }

        add(node.init);
        chunks.push(c("; "));
        add(node.test);
        chunks.push(c("; "));
        add(node.increment);

        chunks.push(c(")"));

        push_array(chunks, handle(node.body, state));

        return chunks;
    },

    /**
     * @param {PHP.Post} node
     */
    post(node, state) {
        return [...handle(node.what, state), c(node.type.repeat(2))];
    },

    /**
     * @param {PHP.Pre} node
     */
    pre(node, state) {
        return [c(node.type.repeat(2)), ...handle(node.what, state)];
    },

    /**
     * @param {PHP.Cast} node
     */
    cast(node, state) {
        return [c("("), c(node.type), c(")"), ...handle(node.expr, state)];
    },

    /**
     * @param {PHP.ArrayLiteral} node
     */
    array(node, state) {
        const indent = `${state.indent}\t`;
        const chunks = [c("[")];

        if (node.items.length) {
            chunks.push(c(`\n${indent}`));
        }

        node.items.forEach((entry, i, arr) => {
            push_array(
                chunks,
                handle(entry, {
                    ...state,
                    indent,
                }),
            );

            const last = i === arr.length - 1;

            chunks.push(c(`,\n${last ? indent.slice(1) : indent}`));
        });

        chunks.push(c("]"));
        return chunks;
    },

    /**
     * @param {PHP.Entry} node
     */
    entry(node, state) {
        /** @type {Chunk[]} */
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

    /**
     * @param {PHP.OffsetLookup} node
     */
    offsetlookup(node, state) {
        const chunks = [...handle(node.what, state), c("[")];

        if (node.offset) {
            push_array(chunks, handle(node.offset, state));
        }

        chunks.push(c("]"));

        return chunks;
    },

    /**
     * @param {PHP.Empty} node
     */
    empty(node, state) {
        return [c("empty("), ...handle(node.expression, state), c(")")];
    },

    /**
     * @param {PHP.Isset} node
     */
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

    /**
     * @param {PHP.StaticLookup} node
     */
    staticlookup(node, state) {
        return [
            ...handle(node.what, state),
            c("::"),
            ...handle(node.offset, state),
        ];
    },

    /**
     * @param {PHP.Unary} node
     */
    unary(node, state) {
        const chunks = [c(node.type)];

        if (node.wrap === true) {
            chunks.push(c("("), ...handle(node.what, state), c(")"));
        } else {
            chunks.push(...handle(node.what, state));
        }

        return chunks;
    },

    /**
     * @param {PHP.Closure} node
     */
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

    /**
     * @param {PHP.ArrowFunc} node
     */
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

    /**
     * @param {PHP.Template} node
     */
    template(node, state) {
        if (node.quasis.length === 1 && node.expressions.length === 0) {
            return [c(`'${node.quasis[0].value.raw.replace(/\'/g, "\\'")}'`)];
        }

        const chunks = [c("sprintf('")];

        for (let i = 0; i < node.quasis.length; i++) {
            const quasi = node.quasis[i];
            chunks.push(c(quasi.value.raw.replace(/\'/g, "\\'")));

            if (!quasi.tail) {
                chunks.push(c("%s"));
            }
        }

        chunks.push(c("'"));

        for (const expression of node.expressions) {
            chunks.push(c(", "));
            chunks.push(...handle(expression, state));
        }

        chunks.push(c(")"));
        return chunks;
    },
};

/**
 * @param {PHP.Node[]} nodes
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
 * @param {PHP.Node} [node]
 * @returns {Chunk}
 */
function c(content, node) {
    return {
        content,
        // @ts-ignore
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

/**
 * @type {Record<string, number>}
 */
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
