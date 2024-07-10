import { describe, test } from "vitest";
import { TemplateRootOf } from "./common.js";
import { parse } from "../../compiler/phases/1-parse/index.js";

describe("Parser: will test tags", () => {
    describe("if tag", () => {
        test("single if", () => {
            TemplateRootOf(`{% if foo %}Text{% endif %}`, [
                {
                    type: "IfBlock",
                    start: 0,
                    end: 27,
                    elseif: false,
                    test: {
                        type: "Identifier",
                        name: "foo",
                        start: 6,
                        end: 9,
                    },
                    consequent: {
                        type: "Fragment",
                        start: 12,
                        end: 16,
                        transparent: false,
                        nodes: [
                            {
                                type: "Text",
                                data: "Text",
                                start: 12,
                                end: 16,
                            },
                        ],
                    },
                    alternate: null,
                },
            ]);
        });

        test("else", () => {
            TemplateRootOf(
                `{% if foo %}consequent{% else %}alternate{% endif %}`,
                [
                    {
                        type: "IfBlock",
                        start: 0,
                        end: 52,
                        elseif: false,
                        test: {
                            type: "Identifier",
                            name: "foo",
                            start: 6,
                            end: 9,
                        },
                        consequent: {
                            type: "Fragment",
                            start: 12,
                            end: 22,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "consequent",
                                    start: 12,
                                    end: 22,
                                },
                            ],
                        },
                        alternate: {
                            type: "Fragment",
                            start: 32,
                            end: 41,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "alternate",
                                    start: 32,
                                    end: 41,
                                },
                            ],
                        },
                    },
                ],
            );
        });

        test("elseif", () => {
            TemplateRootOf(
                `{% if foo %}consequent{% elseif other %}sub consequent{% else %}alternate{% endif %}`,
                [
                    {
                        type: "IfBlock",
                        start: 0,
                        end: 84,
                        elseif: false,
                        test: {
                            type: "Identifier",
                            name: "foo",
                            start: 6,
                            end: 9,
                        },
                        consequent: {
                            type: "Fragment",
                            start: 12,
                            end: 22,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "consequent",
                                    start: 12,
                                    end: 22,
                                },
                            ],
                        },
                        alternate: {
                            type: "Fragment",
                            start: 40,
                            end: 73,
                            transparent: false,
                            nodes: [
                                {
                                    type: "IfBlock",
                                    elseif: true,
                                    start: 22,
                                    end: 84,
                                    test: {
                                        type: "Identifier",
                                        name: "other",
                                        start: 32,
                                        end: 37,
                                    },
                                    consequent: {
                                        type: "Fragment",
                                        start: 40,
                                        end: 54,
                                        transparent: false,
                                        nodes: [
                                            {
                                                type: "Text",
                                                data: "sub consequent",
                                                start: 40,
                                                end: 54,
                                            },
                                        ],
                                    },
                                    alternate: {
                                        type: "Fragment",
                                        start: 64,
                                        end: 73,
                                        transparent: false,
                                        nodes: [
                                            {
                                                type: "Text",
                                                data: "alternate",
                                                start: 64,
                                                end: 73,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                ],
            );
        });

        test("elseif without else", () => {
            TemplateRootOf(
                `{% if foo %}consequent{% elseif other %}elseif{% endif %}`,
                [
                    {
                        type: "IfBlock",
                        start: 0,
                        end: 57,
                        elseif: false,
                        test: {
                            type: "Identifier",
                            name: "foo",
                            start: 6,
                            end: 9,
                        },
                        consequent: {
                            type: "Fragment",
                            start: 12,
                            end: 22,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "consequent",
                                    start: 12,
                                    end: 22,
                                },
                            ],
                        },
                        alternate: {
                            type: "Fragment",
                            start: 40,
                            end: 46,
                            transparent: false,
                            nodes: [
                                {
                                    type: "IfBlock",
                                    elseif: true,
                                    start: 22,
                                    end: 57,
                                    test: {
                                        type: "Identifier",
                                        name: "other",
                                        start: 32,
                                        end: 37,
                                    },
                                    consequent: {
                                        type: "Fragment",
                                        start: 40,
                                        end: 46,
                                        transparent: false,
                                        nodes: [
                                            {
                                                type: "Text",
                                                data: "elseif",
                                                start: 40,
                                                end: 46,
                                            },
                                        ],
                                    },
                                    alternate: null,
                                },
                            ],
                        },
                    },
                ],
            );
        });
    });

    describe("for tag", () => {
        test("simple form", () => {
            TemplateRootOf(`{% for item in array %}Item{% endfor %}`, [
                {
                    type: "ForBlock",
                    start: 0,
                    end: 39,
                    key: null,
                    fallback: null,
                    index: null,
                    expression: {
                        type: "Identifier",
                        name: "array",
                        start: 15,
                        end: 20,
                    },
                    context: {
                        type: "Identifier",
                        name: "item",
                        start: 7,
                        end: 11,
                    },
                    body: {
                        type: "Fragment",
                        start: 23,
                        end: 27,
                        transparent: false,
                        nodes: [
                            {
                                type: "Text",
                                data: "Item",
                                start: 23,
                                end: 27,
                            },
                        ],
                    },
                },
            ]);
        });

        test("else", () => {
            TemplateRootOf(
                `{% for item in array %}Item{% else %}Fallback{% endfor %}`,
                [
                    {
                        type: "ForBlock",
                        start: 0,
                        end: 57,
                        key: null,
                        index: null,
                        expression: {
                            type: "Identifier",
                            name: "array",
                            start: 15,
                            end: 20,
                        },
                        context: {
                            type: "Identifier",
                            name: "item",
                            start: 7,
                            end: 11,
                        },
                        body: {
                            type: "Fragment",
                            start: 23,
                            end: 27,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "Item",
                                    start: 23,
                                    end: 27,
                                },
                            ],
                        },
                        fallback: {
                            type: "Fragment",
                            start: 37,
                            end: 45,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "Fallback",
                                    start: 37,
                                    end: 45,
                                },
                            ],
                        },
                    },
                ],
            );
        });

        test("with index", () => {
            TemplateRootOf(`{% for index, item in array %}Item{% endfor %}`, [
                {
                    type: "ForBlock",
                    start: 0,
                    end: 46,
                    key: null,
                    fallback: null,
                    expression: {
                        type: "Identifier",
                        name: "array",
                        start: 22,
                        end: 27,
                    },
                    index: {
                        type: "Identifier",
                        name: "index",
                        start: 7,
                        end: 12,
                    },
                    context: {
                        type: "Identifier",
                        name: "item",
                        start: 14,
                        end: 18,
                    },
                    body: {
                        type: "Fragment",
                        start: 30,
                        end: 34,
                        transparent: false,
                        nodes: [
                            {
                                type: "Text",
                                data: "Item",
                                start: 30,
                                end: 34,
                            },
                        ],
                    },
                },
            ]);
        });

        describe("keyed", () => {
            test("Identifier as key", () => {
                TemplateRootOf(
                    `{% for item in array #(item) %}Item{% endfor %}`,
                    [
                        {
                            type: "ForBlock",
                            start: 0,
                            end: 47,
                            fallback: null,
                            index: null,
                            key: {
                                type: "Identifier",
                                name: "item",
                                start: 23,
                                end: 27,
                            },
                            expression: {
                                type: "Identifier",
                                name: "array",
                                start: 15,
                                end: 20,
                            },
                            context: {
                                type: "Identifier",
                                name: "item",
                                start: 7,
                                end: 11,
                            },
                            body: {
                                type: "Fragment",
                                start: 31,
                                end: 35,
                                transparent: false,
                                nodes: [
                                    {
                                        type: "Text",
                                        data: "Item",
                                        start: 31,
                                        end: 35,
                                    },
                                ],
                            },
                        },
                    ],
                );
            });

            test("MemberExpression as key", () => {
                TemplateRootOf(
                    `{% for item in array #(item.key) %}Item{% endfor %}`,
                    [
                        {
                            type: "ForBlock",
                            start: 0,
                            end: 51,
                            fallback: null,
                            index: null,
                            key: {
                                type: "MemberExpression",
                                computed: false,
                                start: 23,
                                end: 31,
                                object: {
                                    type: "Identifier",
                                    name: "item",
                                    start: 23,
                                    end: 27,
                                },
                                property: {
                                    type: "Identifier",
                                    name: "key",
                                    start: 28,
                                    end: 31,
                                },
                            },
                            expression: {
                                type: "Identifier",
                                name: "array",
                                start: 15,
                                end: 20,
                            },
                            context: {
                                type: "Identifier",
                                name: "item",
                                start: 7,
                                end: 11,
                            },
                            body: {
                                type: "Fragment",
                                start: 35,
                                end: 39,
                                transparent: false,
                                nodes: [
                                    {
                                        type: "Text",
                                        data: "Item",
                                        start: 35,
                                        end: 39,
                                    },
                                ],
                            },
                        },
                    ],
                );
            });
        });

        test.fails("expect an identifier for context", () => {
            parse(`{% for "context" in array %}{% endfor %}`);
        });

        test.fails("expect an identifier for context with index", () => {
            parse(`{% for index, "context" in array %}{% endfor %}`);
        });

        test.fails(
            "expect an Identifier or MemberExpression only for key",
            () => {
                parse(`{% for context in array #("key") %}{% endfor %}`);
            },
        );
    });

    describe("set tag", () => {
        test("identifier", () => {
            TemplateRootOf(`{% set foo = "value" %}`, [
                {
                    type: "Variable",
                    start: 0,
                    end: 23,
                    assignment: {
                        type: "AssignmentExpression",
                        start: 7,
                        end: 20,
                        left: {
                            type: "Identifier",
                            name: "foo",
                            start: 7,
                            end: 10,
                        },
                        operator: "=",
                        right: {
                            type: "StringLiteral",
                            raw: '"value"',
                            value: "value",
                            start: 13,
                            end: 20,
                        },
                    },
                },
            ]);
        });

        test("member expression", () => {
            TemplateRootOf(`{% set foo.bar = "value" %}`, [
                {
                    type: "Variable",
                    start: 0,
                    end: 27,
                    assignment: {
                        type: "AssignmentExpression",
                        start: 7,
                        end: 24,
                        left: {
                            type: "MemberExpression",
                            start: 7,
                            end: 14,
                            computed: false,
                            object: {
                                type: "Identifier",
                                name: "foo",
                                start: 7,
                                end: 10,
                            },
                            property: {
                                type: "Identifier",
                                name: "bar",
                                start: 11,
                                end: 14,
                            },
                        },
                        operator: "=",
                        right: {
                            type: "StringLiteral",
                            raw: '"value"',
                            value: "value",
                            start: 17,
                            end: 24,
                        },
                    },
                },
            ]);
        });

        test.fails(
            "expected Identifer or MemberExpression ONLY as for the name",
            () => {
                parse(`{% set "foo" = "bar" %}`);
            },
        );
    });

    describe("snippet tag", () => {
        test("simple form", () => {
            TemplateRootOf(`{% snippet name() %}Markup{% endsnippet %}`, [
                {
                    type: "SnippetBlock",
                    start: 0,
                    end: 42,
                    expression: {
                        type: "Identifier",
                        name: "name",
                        start: 11,
                        end: 15,
                    },
                    parameters: [],
                    body: {
                        type: "Fragment",
                        start: 20,
                        end: 26,
                        transparent: false,
                        nodes: [
                            {
                                type: "Text",
                                data: "Markup",
                                start: 20,
                                end: 26,
                            },
                        ],
                    },
                },
            ]);
        });

        test("with one param", () => {
            TemplateRootOf(`{% snippet name(param) %}Markup{% endsnippet %}`, [
                {
                    type: "SnippetBlock",
                    start: 0,
                    end: 47,
                    expression: {
                        type: "Identifier",
                        name: "name",
                        start: 11,
                        end: 15,
                    },
                    parameters: [
                        {
                            type: "Identifier",
                            name: "param",
                            start: 16,
                            end: 21,
                        },
                    ],
                    body: {
                        type: "Fragment",
                        start: 25,
                        end: 31,
                        transparent: false,
                        nodes: [
                            {
                                type: "Text",
                                data: "Markup",
                                start: 25,
                                end: 31,
                            },
                        ],
                    },
                },
            ]);
        });

        test("with many param", () => {
            TemplateRootOf(
                `{% snippet name(param1, param2, param3) %}Markup{% endsnippet %}`,
                [
                    {
                        type: "SnippetBlock",
                        start: 0,
                        end: 64,
                        expression: {
                            type: "Identifier",
                            name: "name",
                            start: 11,
                            end: 15,
                        },
                        parameters: [
                            {
                                type: "Identifier",
                                name: "param1",
                                start: 16,
                                end: 22,
                            },
                            {
                                type: "Identifier",
                                name: "param2",
                                start: 24,
                                end: 30,
                            },
                            {
                                type: "Identifier",
                                name: "param3",
                                start: 32,
                                end: 38,
                            },
                        ],
                        body: {
                            type: "Fragment",
                            start: 42,
                            end: 48,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "Markup",
                                    start: 42,
                                    end: 48,
                                },
                            ],
                        },
                    },
                ],
            );
        });

        test.fails("expect only an Identifier for the name", () => {
            parse(`{% snippet "foo"() %}{% endsnippet %}`);
        });

        test.fails("expect only Identifiers for the parameters", () => {
            parse(`{% snippet foo("param") %}{% endsnippet %}`);
        });
    });

    describe("key tag", () => {
        test("simple form", () => {
            TemplateRootOf(`{% key foo %}Stuff{% endkey %}`, [
                {
                    type: "KeyBlock",
                    start: 0,
                    end: 30,
                    expression: {
                        type: "Identifier",
                        name: "foo",
                        start: 7,
                        end: 10,
                    },
                    fragment: {
                        type: "Fragment",
                        transparent: false,
                        start: 13,
                        end: 18,
                        nodes: [
                            {
                                type: "Text",
                                data: "Stuff",
                                start: 13,
                                end: 18,
                            },
                        ],
                    },
                },
            ]);
        });
    });

    describe("await tag", () => {
        test("simple form", () => {
            TemplateRootOf(`{% await foo then bar %}markup{% endawait %}`, [
                {
                    type: "AwaitBlock",
                    start: 0,
                    end: 44,
                    expression: {
                        type: "Identifier",
                        start: 9,
                        end: 12,
                        name: "foo",
                    },
                    value: {
                        type: "Identifier",
                        start: 18,
                        end: 21,
                        name: "bar",
                    },
                    error: null,
                    pending: null,
                    then: {
                        type: "Fragment",
                        start: 24,
                        end: 30,
                        transparent: false,
                        nodes: [
                            {
                                type: "Text",
                                data: "markup",
                                start: 24,
                                end: 30,
                            },
                        ],
                    },
                    catch: null,
                },
            ]);
        });

        test("with pending", () => {
            TemplateRootOf(
                `{% await foo %}pending{% then bar %}markup{% endawait %}`,
                [
                    {
                        type: "AwaitBlock",
                        start: 0,
                        end: 56,
                        expression: {
                            type: "Identifier",
                            start: 9,
                            end: 12,
                            name: "foo",
                        },
                        value: {
                            type: "Identifier",
                            start: 30,
                            end: 33,
                            name: "bar",
                        },
                        error: null,
                        pending: {
                            type: "Fragment",
                            start: 15,
                            end: 22,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "pending",
                                    start: 15,
                                    end: 22,
                                },
                            ],
                        },
                        then: {
                            type: "Fragment",
                            start: 36,
                            end: 42,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "markup",
                                    start: 36,
                                    end: 42,
                                },
                            ],
                        },
                        catch: null,
                    },
                ],
            );
        });

        test("with pending & catch", () => {
            TemplateRootOf(
                `{% await foo %}pending{% then bar %}markup{% catch err %}error{% endawait %}`,
                [
                    {
                        type: "AwaitBlock",
                        start: 0,
                        end: 76,
                        expression: {
                            type: "Identifier",
                            start: 9,
                            end: 12,
                            name: "foo",
                        },
                        value: {
                            type: "Identifier",
                            start: 30,
                            end: 33,
                            name: "bar",
                        },
                        pending: {
                            type: "Fragment",
                            start: 15,
                            end: 22,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "pending",
                                    start: 15,
                                    end: 22,
                                },
                            ],
                        },
                        then: {
                            type: "Fragment",
                            start: 36,
                            end: 42,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "markup",
                                    start: 36,
                                    end: 42,
                                },
                            ],
                        },
                        error: {
                            type: "Identifier",
                            name: "err",
                            start: 51,
                            end: 54,
                        },
                        catch: {
                            type: "Fragment",
                            start: 57,
                            end: 62,
                            transparent: false,
                            nodes: [
                                {
                                    type: "Text",
                                    data: "error",
                                    start: 57,
                                    end: 62,
                                },
                            ],
                        },
                    },
                ],
            );
        });
    });

    describe("expression tag", () => {
        test("@html tag", () => {
            TemplateRootOf(`{{ @html foo }}`, [
                {
                    type: "HtmlTag",
                    start: 0,
                    end: 15,
                    expression: {
                        type: "Identifier",
                        name: "foo",
                        start: 9,
                        end: 12,
                    },
                },
            ]);
        });

        test("@render tag", () => {
            TemplateRootOf(`{{ @render foo() }}`, [
                {
                    type: "RenderTag",
                    start: 0,
                    end: 19,
                    expression: {
                        type: "FilterExpression",
                        name: {
                            type: "Identifier",
                            name: "foo",
                            start: 11,
                            end: 14,
                        },
                        arguments: [],
                        start: 11,
                        end: 16,
                    },
                },
            ]);
        });

        test("@render tag on call expression", () => {
            TemplateRootOf(`{{ @render foo.bar() }}`, [
                {
                    type: "RenderTag",
                    start: 0,
                    end: 23,
                    expression: {
                        type: "CallExpression",
                        callee: {
                            type: "MemberExpression",
                            start: 11,
                            end: 18,
                            computed: false,
                            object: {
                                type: "Identifier",
                                name: "foo",
                                start: 11,
                                end: 14,
                            },
                            property: {
                                type: "Identifier",
                                name: "bar",
                                start: 15,
                                end: 18,
                            },
                        },
                        arguments: [],
                        start: 11,
                        end: 20,
                    },
                },
            ]);
        });

        test.fails(
            "@render tag expect FilterExpression or CallExpression",
            () => {
                parse(`{{ @render "some other value" }}`);
            },
        );
    });

    test.fails("should crash on unexpected tag opening", () => {
        parse(`{? if ?}`);
    });

    test.fails("should crash on unknown tag", () => {
        parse(`{% unknown %}`);
    });

    test.fails("should crash on else tag in an invalid position", () => {
        parse(`{% else %}`);
    });

    test.fails("should crash on unexpected end tag", () => {
        parse(`{% endunknown %}`);
    });
});
