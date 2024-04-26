import { id, re } from "./utils/id.js";
import Engine from "php-parser";
import { walk } from "./utils/walker/index.js";

// @ts-ignore
const phpParser = new Engine({});

/** @type {Record<string, string>} */
const sigils = {
    "@": "AT",
    "#": "HASH",
};

/** @param {TemplateStringsArray} strings */
const join = (strings) => {
    let str = strings[0];
    for (let i = 1; i < strings.length; i += 1) {
        str += `_${id}_${i - 1}_${strings[i]}`;
    }

    return str.replace(
        /([@#])(\w+)/g,
        (_m, sigil, name) => `_${id}_${sigils[sigil]}_${name}`,
    );
};

const EMPTY = { kind: "Empty" };

/**
 * @param {string} raw
 * @param {import("php-parser").Node} node
 * @param {any[]} values
 */
const inject = (raw, node, values) => {
    return walk(node, {
        /** @param {*} node  */
        leave(node, parent) {
            if (
                (node.kind === "identifier" && parent?.kind !== "property") ||
                node.kind === "name" ||
                node.kind === "variable"
            ) {
                re.lastIndex = 0;
                const match = re.exec(node.name);

                if (match) {
                    if (match[1]) {
                        if ((+match[1]) in values) {
                            let value = values[+match[1]];

                            if (typeof value === "string") {
                                value = {
                                    kind: "identifier",
                                    name: value,
                                };
                            } else if (typeof value === "number") {
                                value = {
                                    kind: "number",
                                    value: value.toString(),
                                };
                            }

                            this.replace(value);
                        }
                    } else {
                        node.name = `${match[2] ? `@` : `#`}${match[4]}`;
                    }
                }
            }

            if (
                node.kind === "expressionstatement" &&
                node.expression.kind === "name"
            ) {
                re.lastIndex = 0;
                const match = re.exec(node.expression.name);

                if (match) {
                    if (match[1]) {
                        if ((+match[1]) in values) {
                            let value = values[+match[1]];
                            this.replace(value);
                        }
                    } else {
                        node.name = `${match[2] ? `@` : `#`}${match[4]}`;
                    }
                }
            }

            if (node.kind === "string") {
                re.lastIndex = 0;
                const new_value = /** @type {string} */ (node.value).replace(
                    re,
                    (m, i) => ((+i) in values ? values[+i] : m),
                );
                const has_changed = new_value !== node.value;
                node.value = new_value;
                if (has_changed && node.raw) {
                    // preserve the quotes
                    node.raw = `${node.raw[0]}${JSON.stringify(
                        node.value,
                    ).slice(1, -1)}${node.raw[node.raw.length - 1]}`;
                }
            }

            if (node.kind === "propertystatement") {
                re.lastIndex = 0;
                const match = re.exec(node.properties[0].name.name);

                if (match) {
                    if (match[1]) {
                        if ((+match[1]) in values) {
                            let value = values[+match[1]];
                            this.replace(value);
                        }
                    } else {
                        node.name = `${match[2] ? `@` : `#`}${match[4]}`;
                    }
                }
            }

            if (node.kind === "program" || node.kind === "block") {
                node.children = flatten_body(node.children, []);
            }

            if (node.kind === "class") {
                node.body = flatten_body(node.body, []);
            }

            if (node.kind === "method") {
                node.arguments = flatten_body(node.arguments, []);
            }
        },
    });
};

/**
 * @param {TemplateStringsArray} strings
 * @param {any[]} values
 */
export function b(strings, ...values) {
    const str = join(strings);

    try {
        let ast = /** @type {any} */ phpParser.parseCode(`<?php ${str}`);

        ast = inject(str, ast, values);

        return ast.children;
    } catch (err) {
        handle_error(str, err);
    }
}

/**
 * @param {TemplateStringsArray} strings
 * @param {any[]} values
 */
export function c(strings, ...values) {
    const str = join(strings);

    try {
        let ast = /** @type {any} */ phpParser.parseEval(
            `class Name { ${str} }`,
        ).children[0].body[0];

        ast = inject(str, ast, values);

        return ast;
    } catch (err) {
        handle_error(str, err);
    }
}

/**
 *
 * @param {TemplateStringsArray} strings
 * @param  {any[]} values
 * @returns {any & { start: Number, end: number }}
 */
export function x(strings, ...values) {
    const str = join(strings);

    try {
        let expression = phpParser.parseEval(str).children[0];

        if (expression.kind !== "expressionstatement") {
            throw new Error(
                `Unexpected node kind '${expression.kind}', expected 'expressionstatement'`,
            );
        }

        if (!str.endsWith(";")) {
            expression = expression.expression;
        }

        expression = inject(str, expression, values);

        return expression;
    } catch (err) {
        handle_error(str, err);
    }
}

/**
 * @param {string} str
 * @param {Error} err
 */
function handle_error(str, err) {
    // TODO location/code frame

    re.lastIndex = 0;
    console.log(`failed to parse:\n${str}`);

    str = str.replace(re, (m, i, at, hash, name) => {
        if (at) return `@${name}`;
        if (hash) return `#${name}`;

        return "${...}";
    });

    throw err;
}

/**
 * @param {any[]} array
 * @param {any[]} target
 */
const flatten_body = (array, target) => {
    for (let i = 0; i < array.length; i += 1) {
        const statement = array[i];
        if (Array.isArray(statement)) {
            flatten_body(statement, target);
            continue;
        }

        if (statement.kind === "expressionstatement") {
            if (statement.expression === EMPTY) continue;

            if (Array.isArray(statement.expression)) {
                // TODO this is hacktacular
                let node = statement.expression[0];
                while (Array.isArray(node)) node = node[0];

                flatten_body(statement.expression, target);
                continue;
            }
        }

        target.push(statement);
    }

    return target;
};

export { print } from "./print/index.js";
