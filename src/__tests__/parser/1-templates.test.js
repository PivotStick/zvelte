import { describe, expect, test } from "vitest";
import { TemplateRootOf } from "./common.js";
import { parse } from "../../compiler/phases/1-parse/index.js";

describe("Parser: will test template nodes", () => {
    test("Comment", () => {
        TemplateRootOf(`<!-- some comment -->`, [
            {
                type: "Comment",
                start: 0,
                end: 21,
                data: " some comment ",
            },
        ]);
    });

    describe("Text", () => {
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

        test("Should automatically close unclosed children", () => {
            TemplateRootOf(`<div>hello <span>world</div>`, [
                {
                    type: "RegularElement",
                    name: "div",
                    start: 0,
                    end: 28,
                    attributes: [],
                    fragment: {
                        type: "Fragment",
                        start: 5,
                        end: 22,
                        transparent: true,
                        nodes: [
                            {
                                type: "Text",
                                data: "hello ",
                                start: 5,
                                end: 11,
                            },
                            {
                                type: "RegularElement",
                                name: "span",
                                start: 11,
                                end: 22,
                                attributes: [],
                                fragment: {
                                    type: "Fragment",
                                    start: 17,
                                    end: 22,
                                    transparent: true,
                                    nodes: [
                                        {
                                            type: "Text",
                                            data: "world",
                                            start: 17,
                                            end: 22,
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            ]);
        });

        test.fails("should crash if has no opening tag", () => {
            parse(`</div>`);
        });

        test.fails("invalid tag name", () => {
            parse(`<@foo />`);
        });
    });

    describe("Attributes", () => {
        /**
         * @param {string} source
         * @param {import("#ast").RegularElement["attributes"]} attributes
         */
        function AttributeOf(source, attributes) {
            TemplateRootOf(source, [
                {
                    type: "RegularElement",
                    start: 0,
                    end: source.length,
                    name: "div",
                    attributes,
                    fragment: {
                        type: "Fragment",
                        transparent: true,
                        start: source.length,
                        end: source.length,
                        nodes: [],
                    },
                },
            ]);
        }

        test("bool", () => {
            AttributeOf(`<div disabled />`, [
                {
                    type: "Attribute",
                    name: "disabled",
                    value: true,
                    start: 5,
                    end: 13,
                },
            ]);
        });

        test("text value", () => {
            AttributeOf(`<div class="foo" />`, [
                {
                    type: "Attribute",
                    name: "class",
                    value: [
                        {
                            type: "Text",
                            data: "foo",
                            start: 12,
                            end: 15,
                        },
                    ],
                    start: 5,
                    end: 16,
                },
            ]);
        });

        test("expression only as value", () => {
            AttributeOf(`<div class="{{ foo }}" />`, [
                {
                    type: "Attribute",
                    name: "class",
                    value: [
                        {
                            type: "ExpressionTag",
                            start: 12,
                            end: 21,
                            expression: {
                                type: "Identifier",
                                name: "foo",
                                start: 15,
                                end: 18,
                            },
                        },
                    ],
                    start: 5,
                    end: 22,
                },
            ]);
        });

        test("quotes are optional if the value is ONLY an expression", () => {
            AttributeOf(`<div class={{ foo }} />`, [
                {
                    type: "Attribute",
                    name: "class",
                    value: [
                        {
                            type: "ExpressionTag",
                            start: 11,
                            end: 20,
                            expression: {
                                type: "Identifier",
                                name: "foo",
                                start: 14,
                                end: 17,
                            },
                        },
                    ],
                    start: 5,
                    end: 20,
                },
            ]);
        });

        test("expression with text", () => {
            AttributeOf(`<div class="{{ foo }} bar" />`, [
                {
                    type: "Attribute",
                    name: "class",
                    value: [
                        {
                            type: "ExpressionTag",
                            start: 12,
                            end: 21,
                            expression: {
                                type: "Identifier",
                                name: "foo",
                                start: 15,
                                end: 18,
                            },
                        },
                        {
                            type: "Text",
                            data: " bar",
                            start: 21,
                            end: 25,
                        },
                    ],
                    start: 5,
                    end: 26,
                },
            ]);
        });

        test("name with same identifier name shortcut", () => {
            AttributeOf(`<div {{ class }} />`, [
                {
                    type: "Attribute",
                    start: 5,
                    end: 16,
                    name: "class",
                    value: [
                        {
                            type: "ExpressionTag",
                            start: 5,
                            end: 16,
                            expression: {
                                type: "Identifier",
                                name: "class",
                                start: 8,
                                end: 13,
                            },
                        },
                    ],
                },
            ]);
        });

        describe("SpreadAttribute", () => {
            test("with spaces", () => {
                AttributeOf(`<div {{ ...foo }} />`, [
                    {
                        type: "SpreadAttribute",
                        start: 5,
                        end: 17,
                        expression: {
                            type: "Identifier",
                            name: "foo",
                            start: 11,
                            end: 14,
                        },
                    },
                ]);
            });

            test("without spaces", () => {
                AttributeOf(`<div {{...foo}} />`, [
                    {
                        type: "SpreadAttribute",
                        start: 5,
                        end: 15,
                        expression: {
                            type: "Identifier",
                            name: "foo",
                            start: 10,
                            end: 13,
                        },
                    },
                ]);
            });
        });

        describe("BindDirective", () => {
            test.fails("expect an expression", () => {
                parse(`<div bind:attr="text" />`);
            });

            test("identifier value", () => {
                AttributeOf(`<div bind:attr="{{ foo }}" />`, [
                    {
                        type: "BindDirective",
                        start: 5,
                        end: 26,
                        name: "attr",
                        modifiers: [],
                        expression: {
                            type: "Identifier",
                            name: "foo",
                            start: 19,
                            end: 22,
                        },
                    },
                ]);
            });

            test("member expression value", () => {
                AttributeOf(`<div bind:attr="{{ foo.bar }}" />`, [
                    {
                        type: "BindDirective",
                        start: 5,
                        end: 30,
                        name: "attr",
                        modifiers: [],
                        expression: {
                            type: "MemberExpression",
                            start: 19,
                            end: 26,
                            computed: false,
                            object: {
                                type: "Identifier",
                                name: "foo",
                                start: 19,
                                end: 22,
                            },
                            property: {
                                type: "Identifier",
                                name: "bar",
                                start: 23,
                                end: 26,
                            },
                        },
                    },
                ]);
            });

            test.fails("expect Identifer or MemberExpression", () => {
                parse(`<div bind:attr={{ "foo" }} />`);
            });

            test("short form", () => {
                AttributeOf(`<div bind:attr />`, [
                    {
                        type: "BindDirective",
                        start: 5,
                        end: 14,
                        name: "attr",
                        modifiers: [],
                        expression: {
                            type: "Identifier",
                            name: "attr",
                            start: 10,
                            end: 14,
                        },
                    },
                ]);
            });

            describe("Special bindings", () => {
                describe("bind:value", () => {
                    test("should work on input, textarea and select", () => {
                        parse(`<input bind:value />`);
                        parse(`<textarea bind:value />`);
                        parse(`<select bind:value />`);
                    });

                    test.fails("should crash otherwise", () => {
                        parse(`<div bind:value />`);
                    });

                    test.fails(
                        "type attribute on inputs ONLY cannot be dynamic",
                        () => {
                            parse(`<input type="{{ foo }}" bind:value />`);
                        }
                    );

                    test("type can be dynamic on textarea and selects", () => {
                        parse(`<textarea type="{{ foo }}" bind:value />`);
                        parse(`<select type="{{ foo }}" bind:value />`);
                    });
                });

                describe("bind:group", () => {
                    test("should work on input", () => {
                        parse(`<input bind:group />`);
                    });

                    test.fails("should crash otherwise", () => {
                        parse(`<div bind:group />`);
                    });
                });

                describe("bind:checked", () => {
                    test("should work on input of type checkbox", () => {
                        parse(`<input type="checkbox" bind:checked />`);
                    });

                    test.fails("should crash on input of other type", () => {
                        parse(`<input type="text" bind:checked />`);
                    });

                    test.fails("should crash on other other element", () => {
                        parse(`<div bind:checked />`);
                    });
                });
            });
        });

        describe("OnDirective", () => {
            test("on directive", () => {
                AttributeOf(`<div on:click="{{ handler }}" />`, [
                    {
                        type: "OnDirective",
                        name: "click",
                        modifiers: [],
                        expression: {
                            type: "Identifier",
                            name: "handler",
                            start: 18,
                            end: 25,
                        },
                        start: 5,
                        end: 29,
                    },
                ]);
            });

            test("on directive with modifiers", () => {
                AttributeOf(
                    `<div on:click|preventDefault|once="{{ handler }}" />`,
                    [
                        {
                            type: "OnDirective",
                            name: "click",
                            modifiers: ["preventDefault", "once"],
                            expression: {
                                type: "Identifier",
                                name: "handler",
                                start: 38,
                                end: 45,
                            },
                            start: 5,
                            end: 49,
                        },
                    ]
                );
            });

            test("on directive with arrow function", () => {
                AttributeOf(`<div on:click="{{ (e) => foo("bar", e) }}" />`, [
                    {
                        type: "OnDirective",
                        name: "click",
                        modifiers: [],
                        expression: {
                            type: "ArrowFunctionExpression",
                            start: 18,
                            end: 38,
                            expression: true,
                            params: [
                                {
                                    type: "Identifier",
                                    name: "e",
                                    start: 19,
                                    end: 20,
                                },
                            ],
                            body: {
                                type: "FilterExpression",
                                name: {
                                    type: "Identifier",
                                    name: "foo",
                                    start: 25,
                                    end: 28,
                                },
                                arguments: [
                                    {
                                        type: "StringLiteral",
                                        value: "bar",
                                        raw: '"bar"',
                                        start: 29,
                                        end: 34,
                                    },
                                    {
                                        type: "Identifier",
                                        name: "e",
                                        start: 36,
                                        end: 37,
                                    },
                                ],
                                start: 25,
                                end: 38,
                            },
                        },
                        start: 5,
                        end: 42,
                    },
                ]);
            });
        });

        describe("ClassDirective", () => {
            test("class directive", () => {
                AttributeOf(`<div class:foo={{ expression }} />`, [
                    {
                        type: "ClassDirective",
                        name: "foo",
                        modifiers: [],
                        start: 5,
                        end: 31,
                        expression: {
                            type: "Identifier",
                            name: "expression",
                            start: 18,
                            end: 28,
                        },
                    },
                ]);
            });

            test("class directive short form", () => {
                AttributeOf(`<div class:foo />`, [
                    {
                        type: "ClassDirective",
                        name: "foo",
                        modifiers: [],
                        start: 5,
                        end: 14,
                        expression: {
                            type: "Identifier",
                            name: "foo",
                            start: 11,
                            end: 14,
                        },
                    },
                ]);
            });
        });

        describe("TransitionDirective", () => {
            test("transition directive", () => {
                AttributeOf(`<div transition:slide />`, [
                    {
                        type: "TransitionDirective",
                        start: 5,
                        end: 21,
                        modifiers: [],
                        intro: true,
                        outro: true,
                        name: "slide",
                        expression: null,
                    },
                ]);
            });

            test("transition directive with param", () => {
                AttributeOf(`<div transition:slide={{ "param" }} />`, [
                    {
                        type: "TransitionDirective",
                        start: 5,
                        end: 35,
                        modifiers: [],
                        intro: true,
                        outro: true,
                        name: "slide",
                        expression: {
                            type: "StringLiteral",
                            raw: '"param"',
                            value: "param",
                            start: 25,
                            end: 32,
                        },
                    },
                ]);
            });

            test("transition in directive", () => {
                AttributeOf(`<div in:slide />`, [
                    {
                        type: "TransitionDirective",
                        start: 5,
                        end: 13,
                        modifiers: [],
                        intro: true,
                        outro: false,
                        name: "slide",
                        expression: null,
                    },
                ]);
            });

            test("transition in directive with param", () => {
                AttributeOf(`<div in:slide={{ params }} />`, [
                    {
                        type: "TransitionDirective",
                        start: 5,
                        end: 26,
                        modifiers: [],
                        intro: true,
                        outro: false,
                        name: "slide",
                        expression: {
                            type: "Identifier",
                            name: "params",
                            start: 17,
                            end: 23,
                        },
                    },
                ]);
            });

            test("transition out directive", () => {
                AttributeOf(`<div out:slide />`, [
                    {
                        type: "TransitionDirective",
                        start: 5,
                        end: 14,
                        modifiers: [],
                        intro: false,
                        outro: true,
                        name: "slide",
                        expression: null,
                    },
                ]);
            });

            test("transition out directive with param", () => {
                AttributeOf(`<div out:slide={{ params }} />`, [
                    {
                        type: "TransitionDirective",
                        start: 5,
                        end: 27,
                        modifiers: [],
                        intro: false,
                        outro: true,
                        name: "slide",
                        expression: {
                            type: "Identifier",
                            name: "params",
                            start: 18,
                            end: 24,
                        },
                    },
                ]);
            });
        });

        describe("UseDirective", () => {
            test("short", () => {
                AttributeOf(`<div use:action />`, [
                    {
                        type: "UseDirective",
                        start: 5,
                        end: 15,
                        modifiers: [],
                        name: "action",
                        expression: null,
                    },
                ]);
            });

            test("with args", () => {
                AttributeOf(`<div use:action={{ "some values" }} />`, [
                    {
                        type: "UseDirective",
                        start: 5,
                        end: 35,
                        modifiers: [],
                        name: "action",
                        expression: {
                            type: "StringLiteral",
                            raw: '"some values"',
                            value: "some values",
                            start: 19,
                            end: 32,
                        },
                    },
                ]);
            });

            test.fails("should not work on components", () => {
                parse(`<zvelte key="foo" use:action />`);
            });

            test.fails("should not work on zvelte:components", () => {
                parse(`<zvelte:component this="{{ foo }}" use:action />`);
            });
        });

        test("value with empty text", () => {
            AttributeOf(`<div name="" />`, [
                {
                    type: "Attribute",
                    name: "name",
                    start: 5,
                    end: 12,
                    value: [
                        {
                            type: "Text",
                            data: "",
                            start: 11,
                            end: 11,
                        },
                    ],
                },
            ]);
        });

        test("value with single quotes", () => {
            AttributeOf(`<div name='value' />`, [
                {
                    type: "Attribute",
                    name: "name",
                    start: 5,
                    end: 17,
                    value: [
                        {
                            type: "Text",
                            data: "value",
                            start: 11,
                            end: 16,
                        },
                    ],
                },
            ]);
        });

        test.fails("cannot have duplicate attributes", () => {
            parse(`<div class="foo" class="bar" />`);
        });

        test.fails("cannot use tag blocks inside attributes", () => {
            parse(`<div {% if foo %}disabled{% endif %} />`);
        });

        test.fails(
            "cannot use non identifier expression directly in attributes",
            () => {
                parse(`<div {{ "random expression" }} />`);
            }
        );
    });

    describe("Style element", () => {
        test("css", () => {
            const ast = parse(`<style>div {color: red;}</style>`);
            expect(ast.css).not.toBeNull();
        });

        test("scss", () => {
            const ast = parse(`<style lang="scss">div {color: red;}</style>`);
            expect(ast.css).not.toBeNull();
        });

        test("self closing", () => {
            const ast = parse(`<style />`);
            expect(ast.css).not.toBeNull();
        });

        test.fails("only one style per components", () => {
            parse(`<style /> <style />`);
        });
    });

    describe("Component", () => {
        test.fails("key is required", () => {
            parse(`<zvelte />`);
        });

        test.fails("key's value must be text", () => {
            parse(`<zvelte key="{{ foo }}" />`);
        });

        test("simplest form", () => {
            TemplateRootOf(`<zvelte key="foo" />`, [
                {
                    type: "Component",
                    start: 0,
                    end: 20,
                    name: "zvelte",
                    key: {
                        type: "Text",
                        data: "foo",
                        start: 13,
                        end: 16,
                    },
                    attributes: [],
                    fragment: {
                        type: "Fragment",
                        transparent: true,
                        start: 20,
                        end: 20,
                        nodes: [],
                    },
                },
            ]);
        });

        test.fails("cannot use class directives", () => {
            parse(`<zvelte key="foo" class:bar />`);
        });

        test.fails("cannot use transition directives", () => {
            parse(`<zvelte key="foo" transition:scale />`);
        });
    });

    describe("ZvelteComponent", () => {
        test.fails("this attribute is required", () => {
            parse(`<zvelte:component />`);
        });

        describe("this attribute can only be an expression", () => {
            test.fails("text value", () => {
                parse(`<zvelte:component this="foo" />`);
            });

            test.fails("bool value", () => {
                parse(`<zvelte:component this />`);
            });
        });

        test.fails("name must match config", () => {
            parse(`<div:component />`);
        });

        test("simplest form", () => {
            TemplateRootOf(`<zvelte:component this="{{ foo }}" />`, [
                {
                    type: "ZvelteComponent",
                    attributes: [],
                    start: 0,
                    end: 37,
                    name: "zvelte:component",
                    expression: {
                        type: "Identifier",
                        name: "foo",
                        start: 27,
                        end: 30,
                    },
                    fragment: {
                        type: "Fragment",
                        transparent: true,
                        nodes: [],
                        start: 37,
                        end: 37,
                    },
                },
            ]);
        });
    });

    test.fails("should crash if unexpected meta tag found", () => {
        parse(`<zvelte:unknown />`);
    });
});
