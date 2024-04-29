import { Lexer } from "twig-lexer";

const lexer = new Lexer();

/**
 * @param {string} sequence
 * @param {import("../index.js").Parser} parser
 */
export const readExpression = (sequence, parser) => {
    let i = 0;
    const tokens = lexer
        .tokenize(`{{${sequence.trim()}}}`)
        .filter((token) => token.type !== "WHITESPACE");

    tokens.shift(); // Removes the "{{"
    tokens.pop(); // Removes the "EOF"
    tokens.pop(); // Removes the "}}"

    return parseExpression();

    function parseExpression() {
        return parseConditional();
    }

    function parseConditional() {
        let test = parseComparison();

        while (match("PUNCTUATION", /\?/)) {
            eat("PUNCTUATION", true);
            const consequent = parseConditional();
            eat("PUNCTUATION", true, /:/);
            const alternate = parseConditional();

            test = {
                type: "ConditionalExpression",
                test,
                consequent,
                alternate,
            };
        }

        return test;
    }

    function parseComparison() {
        /**
         * @type {any}
         */
        let left = parseAdditive();

        while (
            match("OPERATOR", />|<|<=|>=|==|!=|or|in|and|\?\?/) ||
            match("TEST_OPERATOR", /is/)
        ) {
            const operator =
                eat("TEST_OPERATOR", false, /is/)?.value ??
                eat("OPERATOR", true)?.value;

            const right = parseAdditive();

            left = {
                type: "BinaryExpression",
                operator,
                left,
                right,
            };
        }

        return left;
    }

    function parseAdditive() {
        /**
         * @type {any}
         */
        let left = parseMultiplicative();

        while (match("OPERATOR", /\+|-/)) {
            const operator = eat("OPERATOR", true).value;
            const right = parseMultiplicative();

            left = {
                type: "BinaryExpression",
                operator,
                left,
                right,
            };
        }

        return left;
    }

    function parseMultiplicative() {
        /**
         * @type {any}
         */
        let left = parseConcatenation();

        while (match("OPERATOR", /\*|\//)) {
            const operator = eat("OPERATOR", true).value;
            const right = parseConcatenation();

            left = {
                type: "BinaryExpression",
                operator,
                left,
                right,
            };
        }

        return left;
    }

    function parseConcatenation() {
        /**
         * @type {any}
         */
        let left = parsePrimary();

        while (match("OPERATOR", /~/)) {
            const operator = eat("OPERATOR", true).value;
            const right = parsePrimary();

            left = {
                type: "BinaryExpression",
                operator,
                left,
                right,
            };
        }

        return left;
    }

    function parsePrimary() {
        let primary;

        if (match("OPERATOR", /not|-/)) {
            primary = parseUnaryExpression();
        } else if (match("PUNCTUATION", /\(/)) {
            primary = parseParentheziedExpression();
        } else if (match("PUNCTUATION", /\{/)) {
            primary = parseObjectExpression();
        } else if (match("PUNCTUATION", /\[/)) {
            primary = parseArrayExpression();
        } else if (match("NAME", /^((?!true|false|null).*)$/)) {
            primary = parseVariableExpression();

            if (match("PUNCTUATION", /\(/)) {
                eat("PUNCTUATION", true, /\(/);

                const parameters = [];

                while (!match("PUNCTUATION", /\)/) && i < tokens.length) {
                    parameters.push(parseExpression());
                    eat("PUNCTUATION", false, /,/);
                }

                eat("PUNCTUATION", true, /\)/);

                const isFilter = primary.type === "Identifier";

                primary = {
                    type: isFilter ? "FilterExpression" : "CallExpression",
                    name: primary,
                    arguments: parameters,
                };
            }
        } else {
            primary = parseLiteral();
        }

        if (match("PUNCTUATION", /\|/)) {
            const filter = parseFilterExpression();
            filter.arguments.unshift(primary);
            primary = filter;
        }

        return primary;
    }

    function parseArrayExpression() {
        eat("PUNCTUATION", true, /\[/);

        const array = {
            type: "ArrayExpression",
            elements: [],
        };

        while (!match("PUNCTUATION", /\]/)) {
            array.elements.push(parseExpression());
            if (!match("PUNCTUATION", /\]/)) {
                eat("PUNCTUATION", true, /,/);
            }
        }

        eat("PUNCTUATION", true, /\]/);

        return array;
    }

    function parseObjectExpression() {
        eat("PUNCTUATION", true, /\{/);

        const object = {
            type: "ObjectExpression",
            properties: [],
        };

        while (!match("PUNCTUATION", /\}/)) {
            const key = parseStringLiteral() ?? parseIdentifier();
            eat("PUNCTUATION", true, /:/);
            const value = parseExpression();

            const property = {
                type: "Property",
                key,
                value,
            };

            if (!match("PUNCTUATION", /\}/)) {
                eat("PUNCTUATION", true, /,/);
            }

            object.properties.push(property);
        }

        eat("PUNCTUATION", true, /\}/);

        return object;
    }

    function parseUnaryExpression() {
        const operator = eat("OPERATOR", true, /not|-/);

        return {
            type: "UnaryExpression",
            operator: operator.value,
            argument: parsePrimary(),
        };
    }

    function parseParentheziedExpression() {
        eat("PUNCTUATION", true, /\(/);
        const expression = parseExpression();
        eat("PUNCTUATION", true, /\)/);

        return expression;
    }

    function parseVariableExpression() {
        /**
         * @type {any}
         */
        let identifier = parseIdentifier();

        while (match("PUNCTUATION", /\.|\[/)) {
            const computed = match("PUNCTUATION", /\[/);
            if (computed) {
                eat("PUNCTUATION", true, /\[/);
            } else {
                eat("PUNCTUATION", true, /\./);
            }

            const property = computed
                ? parseExpression()
                : parseVariableExpression();

            if (computed) {
                eat("PUNCTUATION", true, /\]/);
            }

            identifier = {
                type: "MemberExpression",
                object: identifier,
                property,
                computed,
            };
        }

        return identifier;
    }

    function parseIdentifier() {
        const name = eat("NAME", true).value;
        return {
            type: "Identifier",
            name,
        };
    }

    function parseLiteral() {
        if (match("NUMBER")) {
            const token = eat("NUMBER", true);
            return {
                type: "NumericLiteral",
                value: Number(token.value),
            };
        }

        if (match("NAME", /^true|false$/)) {
            const value = eat("NAME", true).value;
            return {
                type: "BooleanLiteral",
                value: value === "true",
                raw: value,
            };
        }

        if (match("NAME", /^null$/)) {
            const value = eat("NAME", true).value;
            return {
                type: "NullLiteral",
                value: null,
                raw: value,
            };
        }

        return (
            parseStringLiteral() ??
            (() => {
                const token = current();
                throw parser.error(
                    `Unexpected literal type token, got ${token.type} "${token.value}"`,
                );
            })()
        );
    }

    function parseStringLiteral() {
        if (match("OPENING_QUOTE")) {
            const openingQuote = eat("OPENING_QUOTE", true);
            const value = eat("STRING", false)?.value ?? "";
            const closingQuote = eat("CLOSING_QUOTE", true);

            return {
                type: "StringLiteral",
                value,
                raw: `${openingQuote.value}${value}${closingQuote.value}`,
            };
        }
    }

    function parseFilterExpression() {
        eat("PUNCTUATION", true, /\|/);
        const name = parseIdentifier();
        const parameters = [];

        if (match("PUNCTUATION", /\(/)) {
            eat("PUNCTUATION", true, /\(/);
            while (!match("PUNCTUATION", /\)/) && i < tokens.length) {
                parameters.push(parseExpression());
                eat("PUNCTUATION", false, /,/);
            }
            eat("PUNCTUATION", true, /\)/);
        }

        return {
            type: "FilterExpression",
            name,
            arguments: parameters,
        };
    }

    // -- Utils

    /**
     * @param {string} type
     * @param {RegExp=} value
     */
    function match(type, value = undefined) {
        const token = current();
        const validType = token.type === type;
        const validValue = value === undefined ? true : value.test(token.value);

        return validType && validValue;
    }

    /**
     * @param {string} type
     * @param {boolean=} required
     * @param {RegExp=} value
     * @returns {import("twig-lexer").Token}
     */
    function eat(type, required = false, value = undefined) {
        if (match(type, value)) {
            return tokens[i++];
        }

        if (required) {
            if (value === undefined) {
                throw parser.error(
                    `Unexpected token "${current().type}", expected "${type}"`,
                );
            } else {
                throw parser.error(
                    `Unexpected token "${current().type}" with value "${
                        current().value
                    }", expected "${type}" with value matching "${value}"`,
                );
            }
        }
    }

    /**
     * @returns {any}
     */
    function current() {
        if (i >= tokens.length) {
            return { type: "EOF" };
        }

        return tokens[i];
    }
};
