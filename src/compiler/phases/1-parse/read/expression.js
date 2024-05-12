import { Parser } from "../index.js";

/**
 * @param {Parser} parser
 */
export function parseExpression(parser) {
    return parseConditional(parser);
}

/**
 * @param {Parser} parser
 */
export function parseConditional(parser) {
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
        const end = parser.index;
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
     * @type {"or" | "and" | "||"}
     */
    let operator;

    while (
        // @ts-ignore
        (operator = parser.read(/^(or|and|\|\|)/))
    ) {
        parser.allowWhitespace();
        const right = parseComparison(parser);
        const end = parser.index;
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
export function parseComparison(parser) {
    const start = parser.index;
    let left = parseAdditive(parser);

    parser.allowWhitespace();
    /**
     * @type {">" | "<" | "<=" | ">=" | "==" | "!=" | "in" | "??" | "is"}
     */
    let operator;

    while (
        // @ts-ignore
        (operator = parser.read(/^(<=|>=|==|!=|in|\?\?|>|<|is)/))
    ) {
        parser.allowWhitespace();
        const right = parseAdditive(parser);
        const end = parser.index;
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
export function parseAdditive(parser) {
    const start = parser.index;
    let left = parseMultiplicative(parser);

    parser.allowWhitespace();
    /**
     * @type {"+" | "-"}
     */
    let operator;

    // @ts-ignore
    while ((operator = parser.read(/^(\+|-)/))) {
        parser.allowWhitespace();
        const right = parseMultiplicative(parser);
        const end = parser.index;
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
    let left = parseConcatenation(parser);

    parser.allowWhitespace();
    /**
     * @type {"*" | "/"}
     */
    let operator;

    // @ts-ignore
    while ((operator = parser.read(/^(\*|\/)/))) {
        parser.allowWhitespace();
        const right = parseConcatenation(parser);
        const end = parser.index;
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
export function parseConcatenation(parser) {
    const start = parser.index;
    let left = parseChainableExpression(parser);

    parser.allowWhitespace();

    while (parser.eat("~")) {
        parser.allowWhitespace();
        const right = parseChainableExpression(parser);
        const end = parser.index;
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
        if (parser.matchRegex(/^(\.|\[)/)) {
            const computed = parser.eat("[");
            if (!computed) {
                parser.eat(".", true);
            }
            parser.allowWhitespace();

            const property = computed
                ? parseExpression(parser)
                : parseIdentifier(parser);

            if (!property) {
                throw parser.error(
                    computed
                        ? "Expected an Expression"
                        : "Expected an Identifier",
                );
            }

            parser.allowWhitespace();

            if (computed) {
                parser.eat("]", true);
            }

            const end = parser.index;

            // @ts-ignore
            left = {
                type: "MemberExpression",
                object: left,
                property,
                computed,
                start,
                end,
            };

            return true;
        }
    }

    function parseFilterExpression() {
        if (parser.eat("|")) {
            parser.allowWhitespace();
            const name = parseIdentifier(parser);
            if (!name) throw parser.error("Expected an Identifier");

            parser.allowWhitespace();
            const args = [left];

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
            }

            const end = parser.index;

            left = {
                type: "FilterExpression",
                name,
                arguments: args,
                start,
                end,
            };
            return true;
        }
    }

    function parseCallExpression() {
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

            // @ts-ignore
            left = {
                type:
                    left.type === "Identifier"
                        ? "FilterExpression"
                        : "CallExpression",
                name: left,
                arguments: args,
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
    let from = parsePrimary(parser);

    parser.allowWhitespace();

    if (parser.eat("..")) {
        if (from.type !== "NumericLiteral") {
            throw parser.error("Expected NumericLiteral", from.start);
        }
        parser.allowWhitespace();
        const to = parsePrimary(parser);

        if (to.type !== "NumericLiteral") {
            throw parser.error("Expected NumericLiteral");
        }

        const end = parser.index;

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
            parser.allowWhitespace();
            parser.eat(",", !parser.match("}"));
            const end = parser.index;

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

    if ((raw = parser.read(/^("[^"]*"|'[^']*')/))) {
        const end = parser.index;

        return /** @type {import("../types.js").StringLiteral} */ ({
            type: "StringLiteral",
            raw,
            value: raw.slice(1, -1),
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
