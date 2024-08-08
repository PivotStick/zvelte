import { describe, expect, test } from "vitest";
import { parse } from "../../compiler/phases/1-parse/index.js";

let count = 1;
/**
 * @param {string} source
 * @param {import("./types.js").DeepPartial<import("../../types/index.js").Expression>} expression
 */
function MatchExpression(source, expression) {
    test(String(count++).padStart(3, "0"), () => {
        const ast = parse(source);
        expect(ast).toMatchObject({
            type: "Root",
            fragment: {
                type: "Fragment",
                nodes: [
                    {
                        type: "ExpressionTag",
                        expression,
                    },
                ],
            },
        });
    });
}

describe("LogicalExpression", () => {
    MatchExpression(`{{ a == b ?? foo + 3 }}`, {
        type: "LogicalExpression",
        left: {
            type: "BinaryExpression",
            left: {
                type: "Identifier",
                name: "a",
            },
            operator: "==",
            right: {
                type: "Identifier",
                name: "b",
            },
        },
        operator: "??",
        right: {
            type: "BinaryExpression",
            left: {
                type: "Identifier",
                name: "foo",
            },
            operator: "+",
            right: {
                type: "NumericLiteral",
                value: 3,
            },
        },
    });

    MatchExpression(`{{ a == (b and foo + 3) }}`, {
        type: "BinaryExpression",
        left: {
            type: "Identifier",
            name: "a",
        },
        operator: "==",
        right: {
            type: "LogicalExpression",
            left: {
                type: "Identifier",
                name: "b",
            },
            operator: "and",
            right: {
                type: "BinaryExpression",
                operator: "+",
                left: {
                    type: "Identifier",
                    name: "foo",
                },
                right: {
                    type: "NumericLiteral",
                    value: 3,
                },
            },
        },
    });
});
