import { describe, test } from "vitest";
import { TemplateRootOf } from "./common.js";

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
                ]
            );
        });

        test.todo("elseif");
    });

    describe("for tag", () => {
        test.todo("simple form");
        test.todo("else");
        test.todo("keyed");
    });

    describe("set tag", () => {
        test.todo("simple form");
    });

    describe("snippet tag", () => {
        test.todo("simple form");
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
});
