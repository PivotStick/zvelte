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
        const source = "<div>Hello <span>World!</span></div>";
        expect(parse(source)).toEqual({
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
});
