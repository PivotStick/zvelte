import { test, describe } from "vitest";
import { TemplateRootOf } from "./common.js";
import { parse } from "../../compiler/phases/1-parse/index.js";

describe("Parser: will test expressions", () => {
    /**
     * @param {string} source
     * @param {import("#ast").Expression} expression
     */
    const ExpressionTagOf = (source, expression) => {
        TemplateRootOf(source, [
            {
                type: "ExpressionTag",
                start: 0,
                end: source.length,
                expression,
            },
        ]);
    };

    describe("Unexpected Token", () => {
        test.fails("empty", () => parse(`{{  }}`));
        test.fails("@", () => parse(`{{ @ }}`));
        test.fails("&", () => parse(`{{ & }}`));
    });

    describe("ArrowFunctionExpression", () => {
        test("without arguments", () => {
            ExpressionTagOf(`{{ (   )   =>    null  }}`, {
                type: "ArrowFunctionExpression",
                start: 3,
                end: 21,
                expression: true,
                params: [],
                body: {
                    type: "NullLiteral",
                    start: 17,
                    end: 21,
                    value: null,
                    raw: "null",
                },
            });
        });

        test("with one argument without parentheses", () => {
            ExpressionTagOf(`{{ foo    =>   foo  }}`, {
                type: "ArrowFunctionExpression",
                start: 3,
                end: 18,
                expression: true,
                params: [
                    {
                        type: "Identifier",
                        name: "foo",
                        start: 3,
                        end: 6,
                    },
                ],
                body: {
                    type: "Identifier",
                    name: "foo",
                    start: 15,
                    end: 18,
                },
            });
        });

        test.fails("expect only an identifier with that form", () => {
            parse(`{{ "foo" => foo }}`);
        });

        test("with many arguments", () => {
            ExpressionTagOf(`{{ (arg1, arg2, arg3) => null }}`, {
                type: "ArrowFunctionExpression",
                start: 3,
                end: 29,
                expression: true,
                params: [
                    {
                        type: "Identifier",
                        name: "arg1",
                        start: 4,
                        end: 8,
                    },
                    {
                        type: "Identifier",
                        name: "arg2",
                        start: 10,
                        end: 14,
                    },
                    {
                        type: "Identifier",
                        name: "arg3",
                        start: 16,
                        end: 20,
                    },
                ],
                body: {
                    type: "NullLiteral",
                    value: null,
                    raw: "null",
                    start: 25,
                    end: 29,
                },
            });
        });

        test.fails("expect only an identifiers for params", () => {
            parse(`{{ (arg1, arg2, "arg3") => foo }}`);
        });
    });

    describe("ConditionalExpression", () => {
        test("simple ternary", () => {
            ExpressionTagOf(`{{ foo ? true : false }}`, {
                type: "ConditionalExpression",
                start: 3,
                end: 21,
                test: {
                    type: "Identifier",
                    start: 3,
                    end: 6,
                    name: "foo",
                },
                consequent: {
                    type: "BooleanLiteral",
                    start: 9,
                    end: 13,
                    value: true,
                    raw: "true",
                },
                alternate: {
                    type: "BooleanLiteral",
                    start: 16,
                    end: 21,
                    value: false,
                    raw: "false",
                },
            });
        });
    });

    describe("Identifier", () => {
        test("allowed characters", () => {
            ExpressionTagOf("{{ _f_oo234 }}", {
                type: "Identifier",
                start: 3,
                end: 11,
                name: "_f_oo234",
            });
        });
    });

    describe("UnaryExpression", () => {
        test("not", () => {
            ExpressionTagOf("{{ not foo }}", {
                type: "UnaryExpression",
                start: 3,
                end: 11,
                operator: "not",
                argument: {
                    type: "Identifier",
                    start: 7,
                    end: 10,
                    name: "foo",
                },
            });
        });

        test("+", () => {
            ExpressionTagOf("{{ +foo }}", {
                type: "UnaryExpression",
                start: 3,
                end: 8,
                operator: "+",
                argument: {
                    type: "Identifier",
                    start: 4,
                    end: 7,
                    name: "foo",
                },
            });
        });

        test("-", () => {
            ExpressionTagOf("{{ -foo }}", {
                type: "UnaryExpression",
                start: 3,
                end: 8,
                operator: "-",
                argument: {
                    type: "Identifier",
                    start: 4,
                    end: 7,
                    name: "foo",
                },
            });
        });
    });

    describe("BinaryExpression", () => {
        /**
         * @type {Array<import("#ast").BinaryExpression["operator"]>}
         */
        const operators = [
            "+",
            "-",
            "/",
            "*",
            "~",
            "==",
            "!=",
            "<=",
            ">=",
            "<",
            ">",
        ];

        for (const operator of operators) {
            test(`${operator} operator`, () => {
                ExpressionTagOf(`{{ left ${operator} right }}`, {
                    type: "BinaryExpression",
                    start: 3,
                    end: 8 + operator.length + 6,
                    left: {
                        type: "Identifier",
                        name: "left",
                        start: 3,
                        end: 7,
                    },
                    operator,
                    right: {
                        type: "Identifier",
                        name: "right",
                        start: 8 + operator.length + 1,
                        end: 8 + operator.length + 6,
                    },
                });
            });
        }
    });

    describe("LogicalExpression", () => {
        /**
         * @type {Array<import("#ast").LogicalExpression["operator"]>}
         */
        const operators = ["||", "or", "??", "and"];

        for (const operator of operators) {
            test(`${operator} operator`, () => {
                ExpressionTagOf(`{{ left ${operator} right }}`, {
                    type: "LogicalExpression",
                    start: 3,
                    end: 8 + operator.length + 6,
                    left: {
                        type: "Identifier",
                        name: "left",
                        start: 3,
                        end: 7,
                    },
                    operator,
                    right: {
                        type: "Identifier",
                        name: "right",
                        start: 8 + operator.length + 1,
                        end: 8 + operator.length + 6,
                    },
                });
            });
        }
    });

    describe("StringLiteral", () => {
        test("Double quotes", () => {
            ExpressionTagOf(`{{ "Hello World!" }}`, {
                type: "StringLiteral",
                start: 3,
                end: 17,
                value: "Hello World!",
                raw: '"Hello World!"',
            });
        });

        test("Simple quotes", () => {
            ExpressionTagOf(`{{ 'Hello World!' }}`, {
                type: "StringLiteral",
                start: 3,
                end: 17,
                value: "Hello World!",
                raw: "'Hello World!'",
            });
        });

        test("New Line", () => {
            ExpressionTagOf(`{{ 'Hello\\nWorld!' }}`, {
                type: "StringLiteral",
                start: 3,
                end: 18,
                value: "Hello\nWorld!",
                raw: "'Hello\\nWorld!'",
            });
        });

        test("Espaced New Line", () => {
            ExpressionTagOf(`{{ 'Hello\\\\nWorld!' }}`, {
                type: "StringLiteral",
                start: 3,
                end: 19,
                value: "Hello\\nWorld!",
                raw: "'Hello\\\\nWorld!'",
            });
        });
    });

    describe("BooleanLiteral", () => {
        test("true", () => {
            ExpressionTagOf("{{ true }}", {
                type: "BooleanLiteral",
                start: 3,
                end: 7,
                value: true,
                raw: "true",
            });
        });

        test("false", () => {
            ExpressionTagOf("{{ false }}", {
                type: "BooleanLiteral",
                start: 3,
                end: 8,
                value: false,
                raw: "false",
            });
        });
    });

    describe("NullLiteral", () => {
        test("syntax", () => {
            ExpressionTagOf("{{ null }}", {
                type: "NullLiteral",
                start: 3,
                end: 7,
                value: null,
                raw: "null",
            });
        });
    });

    describe("NumericLiteral", () => {
        test("int", () => {
            ExpressionTagOf("{{ 12345 }}", {
                type: "NumericLiteral",
                start: 3,
                end: 8,
                value: 12345,
                raw: "12345",
            });
        });

        test("float", () => {
            ExpressionTagOf("{{ 12.345 }}", {
                type: "NumericLiteral",
                start: 3,
                end: 9,
                value: 12.345,
                raw: "12.345",
            });
        });

        test("explicit positive int", () => {
            ExpressionTagOf("{{ +49 }}", {
                type: "NumericLiteral",
                start: 3,
                end: 6,
                value: 49,
                raw: "+49",
            });
        });

        test("explicit negative int", () => {
            ExpressionTagOf("{{ -7 }}", {
                type: "NumericLiteral",
                start: 3,
                end: 5,
                value: -7,
                raw: "-7",
            });
        });

        test("explicit positive float", () => {
            ExpressionTagOf("{{ +3.14 }}", {
                type: "NumericLiteral",
                start: 3,
                end: 8,
                value: 3.14,
                raw: "+3.14",
            });
        });

        test("explicit negative float", () => {
            ExpressionTagOf("{{ -0.002 }}", {
                type: "NumericLiteral",
                start: 3,
                end: 9,
                value: -0.002,
                raw: "-0.002",
            });
        });
    });

    describe("ObjectExpression", () => {
        test("empty object", () => {
            ExpressionTagOf("{{ {} }}", {
                type: "ObjectExpression",
                start: 3,
                end: 5,
                properties: [],
            });
        });

        test("one property with correct end index", () => {
            ExpressionTagOf("{{ { a: true     } }}", {
                type: "ObjectExpression",
                start: 3,
                end: 18,
                properties: [
                    {
                        type: "Property",
                        start: 5,
                        end: 12,
                        key: {
                            type: "Identifier",
                            start: 5,
                            end: 6,
                            name: "a",
                        },
                        value: {
                            type: "BooleanLiteral",
                            start: 8,
                            end: 12,
                            value: true,
                            raw: "true",
                        },
                    },
                ],
            });
        });

        test("one property with trailing ','", () => {
            ExpressionTagOf("{{ { property: 'value', } }}", {
                type: "ObjectExpression",
                start: 3,
                end: 25,
                properties: [
                    {
                        type: "Property",
                        start: 5,
                        end: 22,
                        key: {
                            type: "Identifier",
                            start: 5,
                            end: 13,
                            name: "property",
                        },
                        value: {
                            type: "StringLiteral",
                            start: 15,
                            end: 22,
                            value: "value",
                            raw: "'value'",
                        },
                    },
                ],
            });
        });

        test("property as string in simple quotes", () => {
            ExpressionTagOf("{{ { 'prop': false } }}", {
                type: "ObjectExpression",
                start: 3,
                end: 20,
                properties: [
                    {
                        type: "Property",
                        start: 5,
                        end: 18,
                        key: {
                            type: "StringLiteral",
                            start: 5,
                            end: 11,
                            raw: "'prop'",
                            value: "prop",
                        },
                        value: {
                            type: "BooleanLiteral",
                            start: 13,
                            end: 18,
                            value: false,
                            raw: "false",
                        },
                    },
                ],
            });
        });

        test("property as string in double quotes", () => {
            ExpressionTagOf('{{ { "prop": false } }}', {
                type: "ObjectExpression",
                start: 3,
                end: 20,
                properties: [
                    {
                        type: "Property",
                        start: 5,
                        end: 18,
                        key: {
                            type: "StringLiteral",
                            start: 5,
                            end: 11,
                            raw: '"prop"',
                            value: "prop",
                        },
                        value: {
                            type: "BooleanLiteral",
                            start: 13,
                            end: 18,
                            value: false,
                            raw: "false",
                        },
                    },
                ],
            });
        });

        test("many properties", () => {
            ExpressionTagOf(`{{ {foo:true,'bar':null, "other"   :  17 } }}`, {
                type: "ObjectExpression",
                start: 3,
                end: 42,
                properties: [
                    {
                        type: "Property",
                        start: 4,
                        end: 12,
                        key: {
                            type: "Identifier",
                            start: 4,
                            end: 7,
                            name: "foo",
                        },
                        value: {
                            type: "BooleanLiteral",
                            start: 8,
                            end: 12,
                            value: true,
                            raw: "true",
                        },
                    },
                    {
                        type: "Property",
                        start: 13,
                        end: 23,
                        key: {
                            type: "StringLiteral",
                            start: 13,
                            end: 18,
                            raw: "'bar'",
                            value: "bar",
                        },
                        value: {
                            type: "NullLiteral",
                            start: 19,
                            end: 23,
                            value: null,
                            raw: "null",
                        },
                    },
                    {
                        type: "Property",
                        start: 25,
                        end: 40,
                        key: {
                            type: "StringLiteral",
                            raw: '"other"',
                            value: "other",
                            start: 25,
                            end: 32,
                        },
                        value: {
                            type: "NumericLiteral",
                            value: 17,
                            raw: "17",
                            start: 38,
                            end: 40,
                        },
                    },
                ],
            });
        });

        test.fails("expect identifier or string literal for keys", () => {
            parse(`{{ { 15: "foo" } }}`);
        });
    });

    describe("ArrayExpression", () => {
        test("empty", () => {
            ExpressionTagOf(`{{ [] }}`, {
                type: "ArrayExpression",
                start: 3,
                end: 5,
                elements: [],
            });
        });

        test("one value with trailing ','", () => {
            ExpressionTagOf(`{{ [  'yo',   ] }}`, {
                type: "ArrayExpression",
                start: 3,
                end: 15,
                elements: [
                    {
                        type: "StringLiteral",
                        value: "yo",
                        raw: "'yo'",
                        start: 6,
                        end: 10,
                    },
                ],
            });
        });

        test("many values", () => {
            /**
             * @param {number} v
             * @param {number} start
             * @returns {import("#ast").NumericLiteral}
             */
            const n = (v, start) => ({
                type: "NumericLiteral",
                value: v,
                raw: String(v),
                start,
                end: start + String(v).length,
            });

            ExpressionTagOf(`{{ [1, 2, 3, 4, 5] }}`, {
                type: "ArrayExpression",
                start: 3,
                end: 18,
                elements: [n(1, 4), n(2, 7), n(3, 10), n(4, 13), n(5, 16)],
            });
        });
    });

    describe("RangeExpression", () => {
        test("0 to 10", () => {
            ExpressionTagOf(`{{ 0..10 }}`, {
                type: "RangeExpression",
                start: 3,
                end: 8,
                from: {
                    type: "NumericLiteral",
                    start: 3,
                    end: 4,
                    value: 0,
                    raw: "0",
                },
                to: {
                    type: "NumericLiteral",
                    start: 6,
                    end: 8,
                    value: 10,
                    raw: "10",
                },
                step: 1,
            });
        });

        test("10 to 0", () => {
            ExpressionTagOf(`{{ 10..0 }}`, {
                type: "RangeExpression",
                start: 3,
                end: 8,
                from: {
                    type: "NumericLiteral",
                    start: 3,
                    end: 5,
                    value: 10,
                    raw: "10",
                },
                to: {
                    type: "NumericLiteral",
                    start: 7,
                    end: 8,
                    value: 0,
                    raw: "0",
                },
                step: -1,
            });
        });

        test("-10 to 0", () => {
            ExpressionTagOf(`{{ -10..0 }}`, {
                type: "RangeExpression",
                start: 3,
                end: 9,
                from: {
                    type: "NumericLiteral",
                    start: 3,
                    end: 6,
                    value: -10,
                    raw: "-10",
                },
                to: {
                    type: "NumericLiteral",
                    start: 8,
                    end: 9,
                    value: 0,
                    raw: "0",
                },
                step: 1,
            });
        });

        test("-10 to -20", () => {
            ExpressionTagOf(`{{ -10..-20 }}`, {
                type: "RangeExpression",
                start: 3,
                end: 11,
                from: {
                    type: "NumericLiteral",
                    start: 3,
                    end: 6,
                    value: -10,
                    raw: "-10",
                },
                to: {
                    type: "NumericLiteral",
                    start: 8,
                    end: 11,
                    value: -20,
                    raw: "-20",
                },
                step: -1,
            });
        });

        test("0 to -20", () => {
            ExpressionTagOf(`{{ 0..-20 }}`, {
                type: "RangeExpression",
                start: 3,
                end: 9,
                from: {
                    type: "NumericLiteral",
                    start: 3,
                    end: 4,
                    value: 0,
                    raw: "0",
                },
                to: {
                    type: "NumericLiteral",
                    start: 6,
                    end: 9,
                    value: -20,
                    raw: "-20",
                },
                step: -1,
            });
        });

        test.fails("expect numbers only for 'from'", () => {
            parse(`{{ "0"..10 }}`);
        });

        test.fails("expect numbers only for 'to'", () => {
            parse(`{{ 0.."10" }}`);
        });
    });

    describe("MemberExpression", () => {
        test("simplest form", () => {
            ExpressionTagOf(`{{ foo.bar }}`, {
                type: "MemberExpression",
                start: 3,
                end: 10,
                object: {
                    type: "Identifier",
                    name: "foo",
                    start: 3,
                    end: 6,
                },
                computed: false,
                property: {
                    type: "Identifier",
                    name: "bar",
                    start: 7,
                    end: 10,
                },
            });
        });

        test("computed form", () => {
            ExpressionTagOf(`{{ foo['bar'] }}`, {
                type: "MemberExpression",
                start: 3,
                end: 13,
                object: {
                    type: "Identifier",
                    name: "foo",
                    start: 3,
                    end: 6,
                },
                computed: true,
                property: {
                    type: "StringLiteral",
                    value: "bar",
                    raw: "'bar'",
                    start: 7,
                    end: 12,
                },
            });
        });

        test.fails("expect an identifier after '.'", () => {
            parse(`{{ foo."string" }}`);
        });

        test.fails("expect an expression in the computed property", () => {
            parse(`{{ foo[] }}`);
        });
    });

    describe("FilterExpression", () => {
        test.fails("expect an identifier", () => {
            parse(`{{ foo|"bar" }}`);
        });

        test("pipe form without parentheses", () => {
            ExpressionTagOf(`{{ foo|bar }}`, {
                type: "FilterExpression",
                start: 3,
                end: 10,
                name: {
                    type: "Identifier",
                    name: "bar",
                    start: 7,
                    end: 10,
                },
                arguments: [
                    {
                        type: "Identifier",
                        name: "foo",
                        start: 3,
                        end: 6,
                    },
                ],
            });
        });

        test("pipe form without args", () => {
            ExpressionTagOf(`{{ foo|bar() }}`, {
                type: "FilterExpression",
                start: 3,
                end: 12,
                name: {
                    type: "Identifier",
                    name: "bar",
                    start: 7,
                    end: 10,
                },
                arguments: [
                    {
                        type: "Identifier",
                        name: "foo",
                        start: 3,
                        end: 6,
                    },
                ],
            });
        });

        test("pipe form with args", () => {
            ExpressionTagOf(`{{ foo|bar(1, 2) }}`, {
                type: "FilterExpression",
                start: 3,
                end: 16,
                name: {
                    type: "Identifier",
                    name: "bar",
                    start: 7,
                    end: 10,
                },
                arguments: [
                    {
                        type: "Identifier",
                        name: "foo",
                        start: 3,
                        end: 6,
                    },
                    {
                        type: "NumericLiteral",
                        value: 1,
                        raw: "1",
                        start: 11,
                        end: 12,
                    },
                    {
                        type: "NumericLiteral",
                        value: 2,
                        raw: "2",
                        start: 14,
                        end: 15,
                    },
                ],
            });
        });

        test("simple form", () => {
            ExpressionTagOf(`{{ bar(1, 2) }}`, {
                type: "FilterExpression",
                start: 3,
                end: 12,
                name: {
                    type: "Identifier",
                    name: "bar",
                    start: 3,
                    end: 6,
                },
                arguments: [
                    {
                        type: "NumericLiteral",
                        value: 1,
                        raw: "1",
                        start: 7,
                        end: 8,
                    },
                    {
                        type: "NumericLiteral",
                        value: 2,
                        raw: "2",
                        start: 10,
                        end: 11,
                    },
                ],
            });
        });
    });

    describe("IsExpression", () => {
        test("positive", () => {
            ExpressionTagOf(`{{ left is right }}`, {
                type: "IsExpression",
                start: 3,
                end: 16,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                not: false,
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 11,
                    end: 16,
                },
            });
        });

        test("negative", () => {
            ExpressionTagOf(`{{ left is not right }}`, {
                type: "IsExpression",
                start: 3,
                end: 20,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                not: true,
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 15,
                    end: 20,
                },
            });
        });
    });

    describe("InExpression", () => {
        test("positive", () => {
            ExpressionTagOf(`{{ left in right }}`, {
                type: "InExpression",
                start: 3,
                end: 16,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                not: false,
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 11,
                    end: 16,
                },
            });
        });

        test("negative", () => {
            ExpressionTagOf(`{{ left not in right }}`, {
                type: "InExpression",
                start: 3,
                end: 20,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                not: true,
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 15,
                    end: 20,
                },
            });
        });
    });

    describe("AssignmentExpression", () => {
        test("=", () => {
            ExpressionTagOf(`{{ left = right }}`, {
                type: "AssignmentExpression",
                start: 3,
                end: 15,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                operator: "=",
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 10,
                    end: 15,
                },
            });
        });

        test("+=", () => {
            ExpressionTagOf(`{{ left += right }}`, {
                type: "AssignmentExpression",
                start: 3,
                end: 16,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                operator: "+=",
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 11,
                    end: 16,
                },
            });
        });

        test("-=", () => {
            ExpressionTagOf(`{{ left -= right }}`, {
                type: "AssignmentExpression",
                start: 3,
                end: 16,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                operator: "-=",
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 11,
                    end: 16,
                },
            });
        });

        test("~=", () => {
            ExpressionTagOf(`{{ left ~= right }}`, {
                type: "AssignmentExpression",
                start: 3,
                end: 16,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                operator: "~=",
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 11,
                    end: 16,
                },
            });
        });

        test("*=", () => {
            ExpressionTagOf(`{{ left *= right }}`, {
                type: "AssignmentExpression",
                start: 3,
                end: 16,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                operator: "*=",
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 11,
                    end: 16,
                },
            });
        });

        test("/=", () => {
            ExpressionTagOf(`{{ left /= right }}`, {
                type: "AssignmentExpression",
                start: 3,
                end: 16,
                left: {
                    type: "Identifier",
                    name: "left",
                    start: 3,
                    end: 7,
                },
                operator: "/=",
                right: {
                    type: "Identifier",
                    name: "right",
                    start: 11,
                    end: 16,
                },
            });
        });
    });

    describe("UpdateExpression", () => {
        test("++ suffix", () => {
            ExpressionTagOf(`{{ foo++ }}`, {
                type: "UpdateExpression",
                start: 3,
                end: 8,
                argument: {
                    type: "Identifier",
                    name: "foo",
                    start: 3,
                    end: 6,
                },
                operator: "++",
                prefix: false,
            });
        });
        test("-- suffix", () => {
            ExpressionTagOf(`{{ foo-- }}`, {
                type: "UpdateExpression",
                start: 3,
                end: 8,
                argument: {
                    type: "Identifier",
                    name: "foo",
                    start: 3,
                    end: 6,
                },
                operator: "--",
                prefix: false,
            });
        });

        test("++ prefix", () => {
            ExpressionTagOf(`{{ ++foo }}`, {
                type: "UpdateExpression",
                start: 3,
                end: 8,
                argument: {
                    type: "Identifier",
                    name: "foo",
                    start: 5,
                    end: 8,
                },
                operator: "++",
                prefix: true,
            });
        });
        test("-- prefix", () => {
            ExpressionTagOf(`{{ --foo }}`, {
                type: "UpdateExpression",
                start: 3,
                end: 8,
                argument: {
                    type: "Identifier",
                    name: "foo",
                    start: 5,
                    end: 8,
                },
                operator: "--",
                prefix: true,
            });
        });
    });

    describe("CallExpression", () => {
        /**
         * @param {string} source
         * @param {{
         *   start: number;
         *   end: number;
         *   arguments: import("#ast").CallExpression["arguments"];
         * }} args
         */
        function CallFooOf(source, args) {
            ExpressionTagOf(source, {
                ...args,
                type: "CallExpression",
                callee: {
                    type: "MemberExpression",
                    start: 3,
                    end: 8,
                    computed: false,
                    object: {
                        type: "Identifier",
                        name: "_",
                        start: 3,
                        end: 4,
                    },
                    property: {
                        type: "Identifier",
                        name: "foo",
                        start: 5,
                        end: 8,
                    },
                },
            });
        }

        test("without args", () => {
            CallFooOf(`{{ _.foo() }}`, {
                start: 3,
                end: 10,
                arguments: [],
            });
        });

        test("with one arg", () => {
            CallFooOf(`{{ _.foo("hello") }}`, {
                start: 3,
                end: 17,
                arguments: [
                    {
                        type: "StringLiteral",
                        start: 9,
                        end: 16,
                        value: "hello",
                        raw: '"hello"',
                    },
                ],
            });
        });

        test("with many args", () => {
            CallFooOf(`{{ _.foo("hello", 2, 3, 4, 20) }}`, {
                start: 3,
                end: 30,
                arguments: [
                    {
                        type: "StringLiteral",
                        start: 9,
                        end: 16,
                        value: "hello",
                        raw: '"hello"',
                    },
                    {
                        type: "NumericLiteral",
                        start: 18,
                        end: 19,
                        value: 2,
                        raw: "2",
                    },
                    {
                        type: "NumericLiteral",
                        start: 21,
                        end: 22,
                        value: 3,
                        raw: "3",
                    },
                    {
                        type: "NumericLiteral",
                        start: 24,
                        end: 25,
                        value: 4,
                        raw: "4",
                    },
                    {
                        type: "NumericLiteral",
                        start: 27,
                        end: 29,
                        value: 20,
                        raw: "20",
                    },
                ],
            });
        });
    });

    describe("ParentheziedExpression", () => {
        test("binary precedence", () => {
            ExpressionTagOf(`{{ (1 + 2) * 3 }}`, {
                type: "BinaryExpression",
                operator: "*",
                start: 3,
                end: 14,
                left: {
                    type: "BinaryExpression",
                    operator: "+",
                    start: 4,
                    end: 9,
                    left: {
                        type: "NumericLiteral",
                        raw: "1",
                        value: 1,
                        start: 4,
                        end: 5,
                    },
                    right: {
                        type: "NumericLiteral",
                        raw: "2",
                        value: 2,
                        start: 8,
                        end: 9,
                    },
                },
                right: {
                    type: "NumericLiteral",
                    raw: "3",
                    value: 3,
                    start: 13,
                    end: 14,
                },
            });
        });
    });

    describe("Precedences", () => {
        test("concatenation", () => {
            ExpressionTagOf(`{{ "foo" ~ 3 + 5 }}`, {
                type: "BinaryExpression",
                operator: "~",
                start: 3,
                end: 16,
                left: {
                    type: "StringLiteral",
                    start: 3,
                    end: 8,
                    value: "foo",
                    raw: '"foo"',
                },
                right: {
                    type: "BinaryExpression",
                    operator: "+",
                    start: 11,
                    end: 16,
                    left: {
                        type: "NumericLiteral",
                        value: 3,
                        raw: "3",
                        start: 11,
                        end: 12,
                    },
                    right: {
                        type: "NumericLiteral",
                        value: 5,
                        raw: "5",
                        start: 15,
                        end: 16,
                    },
                },
            });
        });
    });
});
