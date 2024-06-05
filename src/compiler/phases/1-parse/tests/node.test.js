import { test, expect, describe } from "@jest/globals";
import { parse } from "../index.js";

describe("Test parser", () => {
    test("try to parse an empty string", () => {
        expect(parse("")).toEqual({
            type: "Root",
            css: null,
            js: null,
            start: 0,
            end: 0,
            fragment: {
                type: "Fragment",
                start: 0,
                end: 0,
                transparent: false,
                nodes: [],
            },
        });
    });

    test("parse a 'Hello World' Text", () => {
        expect(parse("Hello World")).toEqual({
            type: "Root",
            css: null,
            js: null,
            start: 0,
            end: 11,
            fragment: {
                type: "Fragment",
                start: 0,
                end: 11,
                transparent: false,
                nodes: [
                    {
                        type: "Text",
                        start: 0,
                        end: 11,
                        data: "Hello World",
                    },
                ],
            },
        });
    });

    test("parse a regular element", () => {
        expect(parse("<div></div>")).toEqual({
            type: "Root",
            css: null,
            js: null,
            start: 0,
            end: 11,
            fragment: {
                type: "Fragment",
                start: 0,
                end: 11,
                transparent: false,
                nodes: [
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
                ],
            },
        });
    });

    test("parse a regular element with children", () => {
        expect(parse("<div>Hello <span>World!</span></div>")).toEqual({
            type: "Root",
            css: null,
            js: null,
            start: 0,
            end: 36,
            fragment: {
                type: "Fragment",
                start: 0,
                end: 36,
                transparent: false,
                nodes: [
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
                ],
            },
        });
    });

    describe("Test expressions", () => {
        /**
         * @param {string} source
         * @param {any} expression
         */
        const ExpressionTagOf = (source, expression) => {
            return {
                type: "Root",
                js: null,
                css: null,
                start: 0,
                end: source.length,
                fragment: {
                    type: "Fragment",
                    start: 0,
                    end: source.length,
                    transparent: false,
                    nodes: [
                        {
                            type: "ExpressionTag",
                            start: 0,
                            end: source.length,
                            expression,
                        },
                    ],
                },
            };
        };

        test.todo("ArrowFunctionExpression");
        test.todo("ConditionalExpression");

        test("Identifier", () => {
            const source = "{{ foo }}";

            expect(parse(source)).toEqual(
                ExpressionTagOf(source, {
                    type: "Identifier",
                    start: 3,
                    end: 6,
                    name: "foo",
                }),
            );
        });

        describe("UnaryExpression", () => {
            test("not", () => {
                const source = "{{ not foo }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
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
                    }),
                );
            });

            test("+", () => {
                const source = "{{ +foo }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
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
                    }),
                );
            });

            test("-", () => {
                const source = "{{ -foo }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
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
                    }),
                );
            });
        });

        test.todo("BinaryExpression");
        test.todo("LogicalExpression");

        describe("StringLiteral", () => {
            test("Double quotes", () => {
                const source = `{{ "Hello World!" }}`;

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "StringLiteral",
                        start: 3,
                        end: 17,
                        value: "Hello World!",
                        raw: '"Hello World!"',
                    }),
                );
            });

            test("Simple quotes", () => {
                const source = `{{ 'Hello World!' }}`;

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "StringLiteral",
                        start: 3,
                        end: 17,
                        value: "Hello World!",
                        raw: "'Hello World!'",
                    }),
                );
            });
        });

        describe("BooleanLiteral", () => {
            test("true", () => {
                const source = "{{ true }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "BooleanLiteral",
                        start: 3,
                        end: 7,
                        value: true,
                        raw: "true",
                    }),
                );
            });

            test("false", () => {
                const source = "{{ false }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "BooleanLiteral",
                        start: 3,
                        end: 8,
                        value: false,
                        raw: "false",
                    }),
                );
            });
        });

        test("NullLiteral", () => {
            const source = "{{ null }}";

            expect(parse(source)).toEqual(
                ExpressionTagOf(source, {
                    type: "NullLiteral",
                    start: 3,
                    end: 7,
                    value: null,
                    raw: "null",
                }),
            );
        });

        describe("NumericLiteral", () => {
            test("int", () => {
                const source = "{{ 12345 }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "NumericLiteral",
                        start: 3,
                        end: 8,
                        value: 12345,
                        raw: "12345",
                    }),
                );
            });

            test("float", () => {
                const source = "{{ 12.345 }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "NumericLiteral",
                        start: 3,
                        end: 9,
                        value: 12.345,
                        raw: "12.345",
                    }),
                );
            });

            test("explicit positive int", () => {
                const source = "{{ +49 }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "NumericLiteral",
                        start: 3,
                        end: 6,
                        value: 49,
                        raw: "+49",
                    }),
                );
            });

            test("explicit negative int", () => {
                const source = "{{ -7 }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "NumericLiteral",
                        start: 3,
                        end: 5,
                        value: -7,
                        raw: "-7",
                    }),
                );
            });

            test("explicit positive float", () => {
                const source = "{{ +3.14 }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "NumericLiteral",
                        start: 3,
                        end: 8,
                        value: 3.14,
                        raw: "+3.14",
                    }),
                );
            });

            test("explicit negative float", () => {
                const source = "{{ -0.002 }}";

                expect(parse(source)).toEqual(
                    ExpressionTagOf(source, {
                        type: "NumericLiteral",
                        start: 3,
                        end: 9,
                        value: -0.002,
                        raw: "-0.002",
                    }),
                );
            });
        });

        test.todo("ObjectExpression");
        test.todo("ArrayExpression");
        test.todo("MemberExpression");
        test.todo("FilterExpression");
        test.todo("IsExpression");
        test.todo("InExpression");
        test.todo("RangeExpression");
        test.todo("CallExpression");
    });
});
