import { test, expect, describe } from "@jest/globals";
import { parse } from "../index.js";
import { fragment } from "../states/fragment.js";

describe("Test parser", () => {
    /**
     * It creates a Root node without js nor css
     *
     * @param {string} source
     * @param {import("#ast").Fragment["nodes"]} nodes
     */
    function TemplateRootOf(source, nodes) {
        const expectedAST = {
            type: "Root",
            css: null,
            js: null,
            start: 0,
            end: source.length,
            fragment: {
                type: "Fragment",
                start: 0,
                end: source.length,
                transparent: false,
                nodes,
            },
        };

        expect(parse(source)).toEqual(expectedAST);
    }

    test("try to parse an empty string", () => {
        TemplateRootOf("", []);
    });

    test("parse a 'Hello World' Text", () => {
        TemplateRootOf("Hello World", [
            {
                type: "Text",
                start: 0,
                end: 11,
                data: "Hello World",
            },
        ]);
    });

    describe("RegularElement", () => {
        test("empty without children", () => {
            TemplateRootOf("<div></div>", [
                {
                    type: "RegularElement",
                    start: 0,
                    end: 11,
                    name: "div",
                    attributes: [],
                    fragment: {
                        type: "Fragment",
                        start: 5,
                        end: 5,
                        transparent: true,
                        nodes: [],
                    },
                },
            ]);
        });

        test("element with children", () => {
            TemplateRootOf("<div>Hello <span>World!</span></div>", [
                {
                    type: "RegularElement",
                    start: 0,
                    end: 36,
                    name: "div",
                    attributes: [],
                    fragment: {
                        type: "Fragment",
                        start: 5,
                        end: 30,
                        transparent: true,
                        nodes: [
                            {
                                type: "Text",
                                start: 5,
                                end: 11,
                                data: "Hello ",
                            },
                            {
                                type: "RegularElement",
                                start: 11,
                                end: 30,
                                name: "span",
                                attributes: [],
                                fragment: {
                                    type: "Fragment",
                                    start: 17,
                                    end: 23,
                                    transparent: true,
                                    nodes: [
                                        {
                                            type: "Text",
                                            start: 17,
                                            end: 23,
                                            data: "World!",
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            ]);
        });

        test("self closing element", () => {
            TemplateRootOf("<input />", [
                {
                    type: "RegularElement",
                    start: 0,
                    end: 9,
                    name: "input",
                    attributes: [],
                    fragment: {
                        type: "Fragment",
                        transparent: true,
                        start: 9,
                        end: 9,
                        nodes: [],
                    },
                },
            ]);
        });
    });

    describe("Test expressions", () => {
        /**
         * @param {string} source
         * @param {any} expression
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
        });

        test.todo("ConditionalExpression");

        test("Identifier", () => {
            ExpressionTagOf("{{ foo }}", {
                type: "Identifier",
                start: 3,
                end: 6,
                name: "foo",
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

        test.todo("BinaryExpression");
        test.todo("LogicalExpression");

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

        test("NullLiteral", () => {
            ExpressionTagOf("{{ null }}", {
                type: "NullLiteral",
                start: 3,
                end: 7,
                value: null,
                raw: "null",
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
                ExpressionTagOf(
                    `{{ {foo:true,'bar':null, "other"   :  17 } }}`,
                    {
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
                    },
                );
            });
        });

        test.todo("ArrayExpression");

        test.todo("MemberExpression");
        test.todo("FilterExpression");
        test.todo("IsExpression");
        test.todo("InExpression");
        test.todo("RangeExpression");
        test.todo("CallExpression");
    });
});
