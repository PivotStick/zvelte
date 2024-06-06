import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount, tick } from "../../internal/client/index.js";

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

        const h1 = /** @type {HTMLHeadingElement} */ (
            document.body.querySelector("h1")
        );

        expect(h1).not.toBeNull();

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

    test("on:click listener", async () => {
        const listener = vi.fn();
        mount({
            target: document.body,
            scope: { listener },
            source: `<button on:click="{{ listener() }}" />`,
        });

        const button = /** @type {HTMLButtonElement} */ (
            document.body.querySelector("button")
        );

        expect(button).not.toBeNull();
        expect(button.attributes.length).toBe(0);

        expect(listener).not.toHaveBeenCalledOnce();
        button.click();
        expect(listener).toHaveBeenCalledOnce();
    });

    test("counter button", async () => {
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

        const button = /** @type {HTMLButtonElement} */ (
            document.body.querySelector("button")
        );

        expect(button).not.toBeNull();

        for (let i = 0; i < 10; i++) {
            expect(button.textContent).toEqual(`clicks: ${i}`);
            button.click();
            await tick();
        }
    });

    test("if block", async () => {
        mount({
            target: document.body,
            props: { counter: 0 },
            init({ props, scope }) {
                scope.increment = () => {
                    props.counter++;
                };

                scope.decrement = () => {
                    props.counter--;
                };
            },
            source: `
                <button on:click="{{ increment() }}">clicks: {{ counter }}</button>

                {% if counter >= 5 %}
                    <p>not bad!</p>
                    <button on:click="{{ decrement() }}">decrement</button>
                {% endif %}
            `,
        });

        expect(document.body.children.length).toBe(1);

        const incrementButton = /** @type {HTMLButtonElement} */ (
            document.body.children[0]
        );

        expect(incrementButton.nodeName).toBe("BUTTON");
        expect(incrementButton.textContent).toBe("clicks: 0");

        incrementButton.click();
        await tick();

        expect(incrementButton.textContent).toBe("clicks: 1");
        expect(document.body.children.length).toBe(1);

        incrementButton.click();
        incrementButton.click();
        incrementButton.click();
        incrementButton.click();
        await tick();

        expect(document.body.children.length).toBe(3);
        expect(document.body.children[0]).toBe(incrementButton);
        expect(incrementButton.textContent).toBe("clicks: 5");

        const decrementButton = /** @type {HTMLButtonElement} */ (
            document.body.children[2]
        );

        expect(decrementButton).not.toBeNull();
        expect(decrementButton.nodeName).toBe("BUTTON");
        expect(decrementButton.textContent).toBe("decrement");

        const p = document.body.children[1];

        expect(p.nodeName).toBe("P");
        expect(p.textContent).toBe("not bad!");

        decrementButton.click();
        await tick();

        expect(document.body.children.length).toBe(1);
        expect(decrementButton.isConnected).toBeFalsy();
        expect(p.isConnected).toBeFalsy();

        expect(document.body.children[0]).toBe(incrementButton);
        expect(incrementButton.textContent).toBe("clicks: 4");
    });
});
