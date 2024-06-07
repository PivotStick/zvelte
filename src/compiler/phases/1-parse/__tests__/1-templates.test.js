import { describe, test } from "vitest";
import { TemplateRootOf } from "./common.js";

describe("Parser: will test template nodes", () => {
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
});
