import { describe, test } from "vitest";
import { TemplateRootOf } from "./common.js";

describe("Parser: will test tags", () => {
    describe("if tag", () => {
        test.todo("...");
    });

    describe("for tag", () => {
        test.todo("...");
    });

    describe("set tag", () => {
        test.todo("...");
    });

    describe("snippet tag", () => {
        test.todo("...");
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
