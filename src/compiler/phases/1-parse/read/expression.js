import { Parser } from "../index.js";

/**
 * @param {Parser} parser
 */
export function parseExpression(parser) {
    return parseAssignmentExpression(parser);
}

/**
 * @param {Parser} parser
 * @returns {import("#ast").Expression}
 */
export function parseAssignmentExpression(parser) {
    const start = parser.index;
    let left = parseArrowFunctionExpression(parser);
    parser.allowWhitespace();

    /**
     * @type {import("#ast").AssignmentExpression["operator"] | null}
     */
    // @ts-ignore
    const operator = parser.read(/^(=|\+=|-=|\/=|\*=|~=)/);

    if (operator) {
        if (left.type !== "Identifier" && left.type !== "MemberExpression")
            throw parser.error(
                `Invalid left-hand side in assignment`,
                left.start,
            );

        parser.allowWhitespace();
        // @ts-ignore
        const right = parseExpression(parser);

        left = {
            type: "AssignmentExpression",
            start,
            end: right.end,
            operator,
            right,
            left,
        };
    }

    return left;
}

/**
 * @param {Parser} parser
 * @returns {import("../types.js").Expression}
 */
export function parseArrowFunctionExpression(parser) {
    const start = parser.index;
    const foundMatch = parser.matchRegex(/^\(.*\)\s*=>/);

    if (foundMatch) {
        /**
         * @type {import("../types.js").ArrowFunctionExpression["params"]}
         */
        const params = [];

        parser.eat("(", true);
        parser.allowWhitespace();

        while (!parser.eat(")")) {
            const identifier = parseIdentifier(parser);
            if (!identifier)
                throw parser.error("Expected an Identifier", parser.index);
            params.push(identifier);
            parser.allowWhitespace();

            if (!parser.match(")")) {
                parser.eat(",", true);
                parser.allowWhitespace();
            }
        }

        parser.allowWhitespace();
        parser.eat("=>", true);
        parser.allowWhitespace();

        const body = parseExpression(parser);

        return /** @type {import("../types.js").ArrowFunctionExpression} */ ({
            type: "ArrowFunctionExpression",
            start,
            end: body.end,
            expression: true,
            params,
            body,
        });
    }

    const expression = parseConditionalExpression(parser);

    parser.allowWhitespace();

    if (parser.eat("=>")) {
        parser.allowWhitespace();
        /**
         * @type {import("../types.js").ArrowFunctionExpression["params"]}
         */
        const params = [];
        const body = parseExpression(parser);

        if (expression.type === "Identifier") {
            params.push(expression);
        } else {
            throw parser.error("Unexpected expression", start);
        }

        return /** @type {import("../types.js").ArrowFunctionExpression} */ ({
            type: "ArrowFunctionExpression",
            start,
            end: body.end,
            expression: true,
            params,
            body,
        });
    }

    // @ts-ignore
    return expression;
}

/**
 * @param {Parser} parser
 */
export function parseConditionalExpression(parser) {
    const start = parser.index;
    let test = parseLogicExpression(parser);

    parser.allowWhitespace();

    while (parser.eat("?")) {
        parser.allowWhitespace();
        const consequent = parseExpression(parser);
        parser.allowWhitespace();
        parser.eat(":", true);
        parser.allowWhitespace();
        const alternate = parseExpression(parser);
        const end = alternate.end;
        parser.allowWhitespace();

        test = /** @type {import("../types.js").ConditionalExpression} */ ({
            type: "ConditionalExpression",
            test,
            consequent,
            alternate,
            start,
            end,
        });
    }

    return test;
}

/**
 * @param {Parser} parser
 */
export function parseLogicExpression(parser) {
    const start = parser.index;
    let left = parseComparison(parser);

    parser.allowWhitespace();

    /**
     * @type {import("../types.js").LogicalExpression["operator"]}
     */
    let operator;

    while (
        // @ts-ignore
        (operator = parser.read(/^\s*(or|and|\?\?|\|\|)/))
    ) {
        parser.allowWhitespace();
        const right = parseComparison(parser);
        const end = right.end;
        parser.allowWhitespace();

        left = {
            type: "LogicalExpression",
            operator,
            left,
            right,
            start,
            end,
        };
    }

    return left;
}

/**
 * @param {Parser} parser
 */
export function parseComparison(parser) {
    const start = parser.index;
    let left = parseIsExpression(parser);

    parser.allowWhitespace();
    /**
     * @type {">" | "<" | "<=" | ">=" | "==" | "!="}
     */
    let operator;

    while (
        // @ts-ignore
        (operator = parser.read(/^(<=|>=|==|!=|>|<)/))
    ) {
        parser.allowWhitespace();
        const right = parseAdditive(parser);
        const end = right.end;
        parser.allowWhitespace();

        left = {
            type: "BinaryExpression",
            operator,
            left,
            right,
            start,
            end,
        };
    }

    return left;
}

/**
 * @param {Parser} parser
 */
export function parseIsExpression(parser) {
    const start = parser.index;
    let left = parseInExpression(parser);

    parser.allowWhitespace();

    let match;

    while ((match = parser.read(/^is/))) {
        parser.allowWhitespace();
        const not = parser.eat("not");
        parser.allowWhitespace();
        const right = parsePrimary(parser);
        const end = right.end;
        parser.allowWhitespace();

        left = {
            type: "IsExpression",
            start,
            end,
            left,
            right,
            not,
        };
    }

    return left;
}

/**
 * @param {Parser} parser
 */
export function parseInExpression(parser) {
    const start = parser.index;
    let left = parseConcatenation(parser);

    let match;
    while ((match = parser.read(/^(not )?in/))) {
        const not = match.startsWith("not");
        parser.requireWhitespace();
        const right = parseConcatenation(parser);
        const end = right.end;
        parser.allowWhitespace();

        left = {
            type: "InExpression",
            left,
            right,
            start,
            end,
            not,
        };
    }

    return left;
}

/**
 * @param {Parser} parser
 */
export function parseConcatenation(parser) {
    const start = parser.index;
    let left = parseAdditive(parser);

    parser.allowWhitespace();

    while (!parser.match("~=") && parser.eat("~")) {
        parser.allowWhitespace();
        const right = parseAdditive(parser);
        const end = right.end;
        parser.allowWhitespace();

        left = {
            type: "BinaryExpression",
            operator: "~",
            left,
            right,
            start,
            end,
        };
    }

    return left;
}

/**
 * @param {Parser} parser
 */
export function parseAdditive(parser) {
    const start = parser.index;
    let left = parseMultiplicative(parser);

    parser.allowWhitespace();
    /**
     * @type {"+" | "-"}
     */
    let operator;

    // @ts-ignore
    while ((operator = parser.read(/^(\+|-)(?!=)/))) {
        parser.allowWhitespace();
        const right = parseMultiplicative(parser);
        const end = right.end;
        parser.allowWhitespace();

        left = {
            type: "BinaryExpression",
            operator,
            left,
            right,
            start,
            end,
        };
    }

    return left;
}

/**
 * @param {Parser} parser
 */
export function parseMultiplicative(parser) {
    const start = parser.index;
    let left = parseChainableExpression(parser);

    parser.allowWhitespace();
    /**
     * @type {"*" | "/"}
     */
    let operator;

    // @ts-ignore
    while ((operator = parser.read(/^(\*|\/)(?!=)/))) {
        parser.allowWhitespace();
        const right = parseChainableExpression(parser);
        const end = right.end;
        parser.allowWhitespace();

        left = {
            type: "BinaryExpression",
            operator,
            left,
            right,
            start,
            end,
        };
    }

    return left;
}

/**
 * @param {Parser} parser
 */
export function parseChainableExpression(parser) {
    const start = parser.index;
    let left = parseRangeExpression(parser);

    parser.allowWhitespace();

    while (
        parseMemberExpression() ??
        parseFilterExpression() ??
        parseCallExpression()
    ) {
        parser.allowWhitespace();
    }

    function parseMemberExpression() {
        if (parser.matchRegex(/^(\.|\[|\?\.(?!\())/)) {
            const optional = parser.eat("?.");
            const computed = parser.eat("[");

            if (!computed && !optional) {
                parser.eat(".", true);
            }

            parser.allowWhitespace();

            const property = computed
                ? parseExpression(parser)
                : parseIdentifier(parser);

            if (!property) {
                throw parser.error("Expected an Identifier");
            }

            parser.allowWhitespace();

            let end = property.end;

            if (computed) {
                parser.eat("]", true);
                end = parser.index;
            }

            // @ts-ignore
            left = {
                type: "MemberExpression",
                object: left,
                property,
                computed,
                optional,
                start,
                end,
            };

            return true;
        }
    }

    function parseFilterExpression() {
        if (!parser.matchRegex(/^\|\|/) && parser.eat("|")) {
            parser.allowWhitespace();
            const name = parseIdentifier(parser);
            if (!name) throw parser.error("Expected an Identifier");

            parser.allowWhitespace();
            const args = [left];

            let end = name.end;

            if (parser.eat("(")) {
                parser.allowWhitespace();
                while (!parser.eof() && !parser.eat(")")) {
                    args.push(parseExpression(parser));
                    parser.allowWhitespace();
                    if (!parser.match(")")) {
                        parser.eat(",", true);
                        parser.allowWhitespace();
                    }
                }

                end = parser.index;
            }

            left = {
                type: "FilterExpression",
                name,
                arguments: args,
                optional: false,
                start,
                end,
            };
            return true;
        }
    }

    function parseCallExpression() {
        const optional = parser.eat("?.");
        if (parser.eat("(")) {
            parser.allowWhitespace();
            const args = [];

            while (!parser.eof() && !parser.eat(")")) {
                args.push(parseExpression(parser));
                parser.allowWhitespace();
                if (!parser.match(")")) {
                    parser.eat(",", true);
                    parser.allowWhitespace();
                }
            }

            const end = parser.index;

            left =
                left.type === "Identifier"
                    ? {
                          type: "FilterExpression",
                          name: left,
                          arguments: args,
                          optional,
                          start,
                          end,
                      }
                    : {
                          type: "CallExpression",
                          callee: left,
                          arguments: args,
                          optional,
                          start,
                          end,
                      };

            return true;
        }
    }

    return left;
}

/**
 * @param {Parser} parser
 */
export function parseRangeExpression(parser) {
    const start = parser.index;
    let from = parseUpdateExpression(parser);

    parser.allowWhitespace();

    if (parser.eat("..")) {
        if (from.type !== "NumericLiteral") {
            throw parser.error("Expected NumericLiteral", from.start);
        }
        parser.allowWhitespace();
        const to = parseUpdateExpression(parser);

        if (to.type !== "NumericLiteral") {
            throw parser.error("Expected NumericLiteral");
        }

        const end = to.end;

        from = {
            type: "RangeExpression",
            from,
            to,
            step: from.value < to.value ? 1 : -1,
            start,
            end,
        };
    }

    return from;
}

/**
 * @param {Parser} parser
 * @returns {import("#ast").Expression}
 */
export function parseUpdateExpression(parser) {
    const regex = /^(\+\+|--)/;
    const start = parser.index;

    /**
     * @type {import("#ast").UpdateExpression["operator"] | null}
     */
    let operator = null;
    let prefix = false;

    // @ts-ignore
    if ((operator = parser.read(regex))) {
        parser.allowWhitespace();
        prefix = true;
    }

    const argument = parsePrimary(parser);
    parser.allowWhitespace();

    // @ts-ignore
    if ((operator ??= parser.read(regex))) {
        if (
            argument.type !== "Identifier" &&
            argument.type !== "MemberExpression"
        )
            throw parser.error(
                `Invalid ${prefix ? "right-hand" : "left-hand"} side expression in prefix operator`,
                argument.start,
            );

        return {
            type: "UpdateExpression",
            operator,
            start,
            end: prefix ? argument.end : parser.index,
            prefix,
            argument,
        };
    }

    return argument;
}

/**
 * @param {Parser} parser
 * @returns {import("../types.js").UnaryExpression | import("../types.js").Expression | import("../types.js").ObjectExpression}
 */
export function parsePrimary(parser) {
    const primary =
        parseParentheziedExpression(parser) ??
        parseObjectExpression(parser) ??
        parseArrayExpression(parser) ??
        parseBooleanLiteral(parser) ??
        parseNumericLiteral(parser) ??
        parseUnaryExpression(parser) ??
        parseNullLiteral(parser) ??
        parseStringLiteral(parser) ??
        parseIdentifier(parser);

    if (!primary) throw parser.error("Unexpected token");

    return primary;
}

/**
 * @param {Parser} parser
 */
export function parseArrayExpression(parser) {
    const start = parser.index;
    if (parser.eat("[")) {
        parser.allowWhitespace();

        const elements = [];

        while (!parser.eat("]")) {
            elements.push(parseExpression(parser));
            parser.allowWhitespace();
            if (!parser.match("]")) {
                parser.eat(",", true);
                parser.allowWhitespace();
            }
        }

        const end = parser.index;

        return /** @type {import("../types.js").ArrayExpression} */ ({
            type: "ArrayExpression",
            elements,
            start,
            end,
        });
    }
}

/**
 * @param {Parser} parser
 */
export function parseObjectExpression(parser) {
    const start = parser.index;
    if (parser.eat("{")) {
        parser.allowWhitespace();

        const properties = [];

        while (!parser.eat("}")) {
            const start = parser.index;
            const key = parseStringLiteral(parser) ?? parseIdentifier(parser);

            if (!key) throw parser.error("Unexpected token");

            parser.allowWhitespace();
            parser.eat(":", true);
            parser.allowWhitespace();

            const value = parseExpression(parser);
            const end = value.end;

            parser.allowWhitespace();
            parser.eat(",", !parser.match("}"));

            const property = {
                type: "Property",
                key,
                value,
                start,
                end,
            };

            properties.push(property);
            parser.allowWhitespace();
        }

        const end = parser.index;

        return /** @type {import("../types.js").ObjectExpression} */ ({
            type: "ObjectExpression",
            properties,
            start,
            end,
        });
    }
}

/**
 * @param {Parser} parser
 */
export function parseUnaryExpression(parser) {
    const start = parser.index;
    let operator;

    if ((operator = parser.read(/^(not(?=\s)|-|\+)/))) {
        if (operator === "not") {
            parser.requireWhitespace();
        }
        const argument = parseChainableExpression(parser);
        const end = parser.index;

        return /** @type {import("../types.js").UnaryExpression} */ ({
            type: "UnaryExpression",
            operator,
            argument,
            start,
            end,
        });
    }
}

/**
 * @param {Parser} parser
 */
export function parseParentheziedExpression(parser) {
    if (parser.eat("(")) {
        parser.allowWhitespace();
        const expression = parseExpression(parser);
        parser.allowWhitespace();
        parser.eat(")", true);

        return expression;
    }
}

/**
 * @param {Parser} parser
 */
export function parseIdentifier(parser) {
    const start = parser.index;
    let name;

    if ((name = parser.read(/^[a-zA-Z_\$][\w]*/))) {
        const end = parser.index;

        return /** @type {import("../types.js").Identifier} */ ({
            type: "Identifier",
            name,
            start,
            end,
        });
    }
}

/**
 * @param {Parser} parser
 */
export function parseNumericLiteral(parser) {
    const start = parser.index;
    let raw;

    if ((raw = parser.read(/^[+-]?([0-9]*\.)?[0-9]+/))) {
        const end = parser.index;

        return /** @type {import("../types.js").NumericLiteral} */ ({
            type: "NumericLiteral",
            raw,
            value: Number(raw),
            start,
            end,
        });
    }
}

/**
 * @param {Parser} parser
 */
export function parseBooleanLiteral(parser) {
    const start = parser.index;
    let raw;

    if ((raw = parser.read(/^(true|false)(?!\w)/))) {
        const end = parser.index;

        return /** @type {import("../types.js").BooleanLiteral} */ ({
            type: "BooleanLiteral",
            value: raw === "true",
            raw,
            start,
            end,
        });
    }
}

/**
 * @param {Parser} parser
 */
export function parseStringLiteral(parser) {
    const start = parser.index;
    let raw;

    if ((raw = parser.read(/^("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/))) {
        const end = parser.index;

        return /** @type {import("../types.js").StringLiteral} */ ({
            type: "StringLiteral",
            raw,
            value: raw
                .slice(1, -1)
                .replace(/(?<!\\)\\n/g, "\n")
                .replace(/\\\\n/g, "\\n"),
            start,
            end,
        });
    }
}

/**
 * @param {Parser} parser
 */
export function parseNullLiteral(parser) {
    const start = parser.index;
    let raw;

    if ((raw = parser.read(/^null(?!\w)/))) {
        const end = parser.index;

        return /** @type {import("../types.js").NullLiteral} */ ({
            type: "NullLiteral",
            value: null,
            raw,
            start,
            end,
        });
    }
}
