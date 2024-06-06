// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from "vitest";
import { mount } from "../../internal/client/index.js";
import { tick } from "svelte/internal/client";

beforeEach(() => {
    document.body.innerHTML = "";
});

describe("Test client's internal mount()", () => {
    test("text", () => {
        mount({
            target: document.body,
            source: "Hello World",
        });

        expect(document.body.textContent).toEqual("Hello World");
    });

    test("element", () => {
        mount({
            target: document.body,
            source: "<h1></h1>",
        });

        const h1 = document.body.querySelector("h1");

        expect(h1).not.toBeNull();
        expect(h1?.innerText).toEqual("");
        expect(h1?.attributes.length).toEqual(0);
    });

    test("self closing element", () => {
        mount({
            target: document.body,
            source: "<h1 />",
        });

        const h1 = document.body.querySelector("h1");

        expect(h1).not.toBeNull();
        expect(h1?.innerText).toEqual("");
        expect(h1?.attributes.length).toEqual(0);
    });

    test("element with text", () => {
        mount({
            target: document.body,
            source: "<h1>Hello World!</h1>",
        });

        const h1 = document.body.querySelector("h1");

        expect(h1).not.toBeNull();
        expect(h1?.innerText).toEqual("Hello World!");
    });

    test("element with children", () => {
        mount({
            target: document.body,
            source: "<h1>Hello <span>Joe</span>!</h1>",
        });

        const h1 = document.body.querySelector("h1");

        expect(h1).not.toBeNull();
        if (!h1) throw new Error();

        expect(h1.childNodes[0].nodeName).toEqual("#text");
        expect(h1.childNodes[0].textContent).toEqual("Hello ");

        expect(h1.childNodes[1].nodeName).toEqual("SPAN");
        expect(h1.childNodes[1].textContent).toEqual("Joe");

        expect(h1.childNodes[2].nodeName).toEqual("#text");
        expect(h1.childNodes[2].textContent).toEqual("!");
    });

    test("text with first prop", () => {
        mount({
            target: document.body,
            props: { name: "Joe" },
            source: "<h1>Hello {{ name }}!</h1>",
        });

        expect(document.body.querySelector("h1")).not.toBeNull();
        expect(document.body.textContent).toEqual("Hello Joe!");
    });

    test("counter", async () => {
        mount({
            target: document.body,
            props: { counter: 0 },
            init({ props, scope }) {
                scope.increment = () => {
                    props.counter++;
                };
            },
            source: `<button on:click="{{ increment() }}">clicks: {{ counter }}</button>`,
        });

        let button = /** @type {HTMLButtonElement} */ (
            document.body.querySelector("button")
        );

        expect(button).not.toBeNull();

        for (let i = 0; i < 10; i++) {
            expect(button.textContent).toEqual(`clicks: ${i}`);
            button.click();
            await tick();
        }
    });
});
