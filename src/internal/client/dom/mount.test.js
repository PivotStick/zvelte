import { beforeEach, describe, expect, test, vi } from "vitest";
import { createComponent, mount } from "./mount.js";
import { proxy, tick } from "../index.js";
import { parse } from "../../../compiler/phases/1-parse/index.js";

/**
 * @type {ReturnType<typeof mount>=}
 */
let currentInstance;

beforeEach(() => {
    currentInstance?.destroy();
    currentInstance = undefined;
    document.body.innerHTML = "";
});

describe("Test client's internal mount()", () => {
    test("destroy component", () => {
        const instance = mount({
            target: document.body,
            source: "Hello World",
        });

        expect(document.body.textContent).toEqual("Hello World");
        instance.destroy();
        expect(document.body.textContent).toEqual("");
    });

    describe("RegularElement", () => {
        describe("Attributes", () => {
            describe("OnDirective", () => {
                test("on:click listener", async () => {
                    const listener = vi.fn();

                    currentInstance = mount({
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
            });

            describe("BindDirective", () => {
                test("bind:value on input", async () => {
                    const props = proxy({ value: "foo" });

                    currentInstance = mount({
                        target: document.body,
                        props,
                        source: `<input type="text" bind:value />`,
                    });

                    const input = /** @type {HTMLInputElement} */ (
                        document.body.querySelector("input")
                    );

                    expect(input).toBeInstanceOf(HTMLInputElement);
                    expect(input.value).toBe("foo");
                    expect(props.value).toBe("foo");

                    input.value = "bar";
                    expect(props.value).toBe("foo");
                    input.dispatchEvent(new InputEvent("input"));

                    expect(input.value).toBe("bar");
                    expect(props.value).toBe("bar");

                    props.value = "foo";
                    await tick();
                    expect(input.value).toBe("foo");
                });

                test("bind:value on select", async () => {
                    const props = proxy({ value: "yes" });

                    currentInstance = mount({
                        target: document.body,
                        props,
                        source: `<select bind:value><option value="yes" /><option value="no" /></select>`,
                    });

                    const select = /** @type {HTMLSelectElement} */ (
                        document.body.querySelector("select")
                    );

                    expect(select).toBeInstanceOf(HTMLSelectElement);
                    expect(select.children).toHaveLength(2);

                    const [option0, option1] =
                        // @ts-ignore
                        /** @type {HTMLOptionElement[]} */ (select.children);

                    expect(option0.selected).toBe(true);
                    expect(option1.selected).toBe(false);
                    expect(select.value).toBe("yes");

                    props.value = "no";
                    await tick();

                    expect(option0.selected).toBe(false);
                    expect(option1.selected).toBe(true);
                    expect(select.value).toBe("no");

                    select.value = "yes";

                    expect(option0.selected).toBe(true);
                    expect(option1.selected).toBe(false);
                    expect(props.value).toBe("no");
                    select.dispatchEvent(new InputEvent("input"));
                    expect(props.value).toBe("yes");
                });

                test("bind:value on textarea", async () => {
                    const props = proxy({ value: "foo" });

                    currentInstance = mount({
                        target: document.body,
                        props,
                        source: `<textarea bind:value />`,
                    });

                    const textarea = /** @type {HTMLTextAreaElement} */ (
                        document.body.querySelector("textarea")
                    );

                    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
                    expect(textarea.value).toBe("foo");
                    expect(props.value).toBe("foo");

                    textarea.value = "bar";
                    expect(props.value).toBe("foo");
                    textarea.dispatchEvent(new InputEvent("input"));

                    expect(textarea.value).toBe("bar");
                    expect(props.value).toBe("bar");

                    props.value = "foo";
                    await tick();
                    expect(textarea.value).toBe("foo");
                });

                test.todo("bind:checked");
                test.todo("bind:this");
                test.todo("bind:group");
            });

            describe.todo("ClassDirective");
            describe.todo("TransitionDirective");
            describe.todo("Spread");
        });
    });

    describe("IfBlock", () => {
        test("if", async () => {
            currentInstance = mount({
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

        test("if else", async () => {
            const props = proxy({ counter: 0 });

            currentInstance = mount({
                target: document.body,
                props,
                source: `
                    {% if counter >= 5 %}
                        <p>Consequent</p>
                    {% else %}
                        <p>Alternate</p>
                    {% endif %}
                `,
            });

            expect(document.body.children).toHaveLength(1);
            expect(document.body.children[0]).toBeInstanceOf(
                HTMLParagraphElement
            );
            expect(document.body.children[0].textContent).toBe("Alternate");

            props.counter = 5;
            await tick();

            expect(document.body.children).toHaveLength(1);
            expect(document.body.children[0]).toBeInstanceOf(
                HTMLParagraphElement
            );
            expect(document.body.children[0].textContent).toBe("Consequent");

            props.counter--;
            await tick();

            expect(document.body.children).toHaveLength(1);
            expect(document.body.children[0]).toBeInstanceOf(
                HTMLParagraphElement
            );
            expect(document.body.children[0].textContent).toBe("Alternate");
        });

        test("if elseif", async () => {
            const props = proxy({ counter: 0 });

            currentInstance = mount({
                target: document.body,
                props,
                source: `
                    {% if counter >= 5 %}
                        <p>Consequent</p>
                    {% elseif counter >= 2 %}
                        <p>Alternate If</p>
                    {% endif %}
                `,
            });

            async function validate() {
                if (props.counter >= 5) {
                    expect(document.body.children).toHaveLength(1);
                    expect(document.body.children[0]).toBeInstanceOf(
                        HTMLParagraphElement
                    );
                    expect(document.body.children[0].attributes).toHaveLength(
                        0
                    );
                    expect(document.body.children[0].textContent).toBe(
                        "Consequent"
                    );
                } else if (props.counter >= 2) {
                    expect(document.body.children).toHaveLength(1);
                    expect(document.body.children[0]).toBeInstanceOf(
                        HTMLParagraphElement
                    );
                    expect(document.body.children[0].attributes).toHaveLength(
                        0
                    );
                    expect(document.body.children[0].textContent).toBe(
                        "Alternate If"
                    );
                } else {
                    expect(document.body.children).toHaveLength(0);
                }
            }

            async function add(n = 0) {
                props.counter += n;
                await tick();
                await validate();
            }

            await validate();

            await add(2);
            await add(3);
            await add(10);

            await add(-10);
            await add(-3);
            await add(-2);
        });
    });

    describe("SnippetBlock & RenderTag", () => {
        test.todo("with one arg");

        test.todo("with many args");
    });

    describe("ForBlock", () => {
        test.todo("loop variable");

        test.todo("fallback");

        test("2 deep for blocks with bind:group in nested for block", async () => {
            const datas = [
                {
                    name: "First",
                    roles: ["foo", "bar", "baz"],
                    selected: [],
                    open: true,
                },
                {
                    name: "Second",
                    roles: ["yes", "no", "stuff", "something"],
                    selected: ["yes"],
                    open: false,
                },
                {
                    name: "Third",
                    roles: ["admin", "modo", "user"],
                    selected: ["modo", "user"],
                    open: false,
                },
                {
                    name: "Fourth",
                    roles: ["owner", "distributor", "seller"],
                    selected: [],
                    open: false,
                },
            ];

            currentInstance = mount({
                target: document.body,
                init({ props, scope }) {
                    props.sections = datas;

                    scope.open = (/** @type {*} */ section) => {
                        section.open = !section.open;
                    };
                },
                source: `
                {% for section in sections %}
                    <section>
                        <h1 on:click="{{ open(section) }}">{{ section.name }} {{ section.selected|length }} / {{ section.roles|length }} <div class="bar" /></h1>
                        {% if section.open %}
                            <ul>
                                {% for role in section.roles %}
                                    <li>
                                        <label>
                                            <input type="checkbox" bind:group="{{ section.selected }}" value="{{ role }}" />
                                            <span>{{ role }}</span>
                                        </label>
                                    </li>
                                {% endfor %}
                            </ul>
                        {% endif %}
                    </section>
                {% endfor %}
            `,
            });

            function validate() {
                expect(document.body.children).toHaveLength(datas.length);

                for (let i = 0; i < document.body.children.length; i++) {
                    const section = document.body.children[i];
                    const data = datas[i];

                    expect(section.nodeName).toBe("SECTION");
                    expect(section.children).toHaveLength(data.open ? 2 : 1);

                    const h1 = section.children[0];

                    expect(h1.nodeName).toBe("H1");
                    expect(h1.attributes).toHaveLength(0);
                    expect(h1.textContent).toBe(
                        `${data.name} ${data.selected.length} / ${data.roles.length} `
                    );

                    if (data.open) {
                        const ul = section.children[1];

                        expect(ul.nodeName).toBe("UL");
                        expect(ul.children).toHaveLength(data.roles.length);

                        for (let i = 0; i < ul.children.length; i++) {
                            const li = ul.children[i];
                            const role = data.roles[i];

                            expect(li.nodeName).toBe("LI");
                            expect(li.children).toHaveLength(1);
                            expect(li.attributes).toHaveLength(0);

                            const label = li.children[0];

                            expect(label.nodeName).toBe("LABEL");
                            expect(label.children).toHaveLength(2);
                            expect(label.attributes).toHaveLength(0);

                            const input = label.children[0];
                            const span = label.children[1];

                            expect(input.nodeName).toBe("INPUT");
                            expect(input.children).toHaveLength(0);
                            expect(input.attributes).toHaveLength(2);

                            expect(input.attributes[0].name).toBe("type");
                            expect(input.attributes[0].value).toBe("checkbox");

                            expect(input.attributes[1].name).toBe("value");
                            expect(input.attributes[1].value).toBe(role);

                            expect(span.nodeName).toBe("SPAN");
                            expect(span.children).toHaveLength(0);
                            expect(span.attributes).toHaveLength(0);
                            expect(span.textContent).toBe(role);
                        }
                    }
                }
            }

            /**
             * @param {string} selectors
             */
            async function click(selectors) {
                const element = /** @type {HTMLElement} */ (
                    document.querySelector(selectors)
                );
                expect(element).toBeInstanceOf(HTMLElement);

                element.click();
                await tick();
                validate();
            }

            validate();

            await click("body > section:nth-child(1) > h1");

            for (const data of datas) {
                expect(data.open).toBe(false);
            }

            await click("body > section:nth-child(1) > h1");
            await click("body > section:nth-child(2) > h1");
            await click("body > section:nth-child(3) > h1");
            await click("body > section:nth-child(4) > h1");

            for (const data of datas) {
                expect(data.open).toBe(true);
            }

            await click("body > section:nth-child(2) > h1");
            await click("body > section:nth-child(3) > h1");
            await click("body > section:nth-child(4) > h1");

            for (let i = 0; i < datas.length; i++) {
                const data = datas[i];
                expect(data.open).toBe(i === 0);
            }

            await click(
                "body > section:nth-child(1) > ul > li:nth-child(1) > label"
            );

            expect(datas[0].selected).toHaveLength(1);
            expect(datas[0].selected[0]).toEqual(datas[0].roles[0]);

            await click(
                "body > section:nth-child(1) > ul > li:nth-child(2) > label"
            );
            await click(
                "body > section:nth-child(1) > ul > li:nth-child(3) > label"
            );

            expect(datas[0].selected).toHaveLength(3);

            for (let i = 0; i < datas[0].selected.length; i++) {
                const value = datas[0].selected[i];
                expect(datas[0].roles).toContain(value);
            }

            await click("body > section:nth-child(2) > h1");

            for (let i = 0; i < datas.length; i++) {
                const data = datas[i];
                expect(data.open).toBe(i <= 1);
            }

            expect(datas[1].selected).toHaveLength(1);
            expect(datas[1].selected[0]).toEqual(datas[1].roles[0]);

            await click(
                "body > section:nth-child(2) > ul > li:nth-child(1) > label"
            );

            expect(datas[1].selected).toHaveLength(0);

            await click(
                "body > section:nth-child(2) > ul > li:nth-child(1) > label"
            );
            await click(
                "body > section:nth-child(2) > ul > li:nth-child(2) > label"
            );
            await click(
                "body > section:nth-child(2) > ul > li:nth-child(3) > label"
            );
            await click(
                "body > section:nth-child(2) > ul > li:nth-child(4) > label"
            );

            expect(datas[1].selected).toHaveLength(4);

            for (let i = 0; i < datas[1].selected.length; i++) {
                const value = datas[1].selected[i];
                expect(datas[1].roles).toContain(value);
            }
        });
    });

    describe("Expressions", () => {
        /**
         * @param {string} expression
         * @param {any} expected
         * @param {any} init
         */
        function ExpressionOf(expression, expected, init = {}) {
            const props = proxy({ output: undefined, ...init });
            const instance = mount({
                target: document.body,
                props,
                source: `{% set output = ${expression} %}`,
            });

            expect(document.body.children).toHaveLength(0);
            if (typeof expected === "function") {
                expected(props.output);
            } else {
                expect(props.output).toEqual(expected);
            }

            instance.destroy();
        }

        describe("FilterExpression", () => {
            test("Without args", () => {
                const fn = vi.fn();

                ExpressionOf(`foo()`, 30, { foo: () => 10 * 3 });
                ExpressionOf(`foo()`, undefined, { foo: fn });

                expect(fn).toHaveBeenCalledOnce();
            });

            test("With one arg", () => {
                const foo = vi.fn((a) => a * 10);

                ExpressionOf(`foo(10)`, 100, { foo });
                ExpressionOf(`foo("5")`, 50, { foo });

                expect(foo).toHaveBeenCalledTimes(2);
                expect(foo.mock.results).toEqual([
                    { type: "return", value: 100 },
                    { type: "return", value: 50 },
                ]);
            });

            test("With many args", () => {
                const foo = vi.fn((a, b, suffix = "!") => a * b + suffix);

                ExpressionOf(`foo(10, 10)`, "100!", { foo });
                ExpressionOf(`foo(3, 2)`, "6!", { foo });
                ExpressionOf(`foo(5, 5, " woaw!")`, "25 woaw!", { foo });

                expect(foo).toHaveBeenCalledTimes(3);
                expect(foo.mock.results).toEqual([
                    { type: "return", value: "100!" },
                    { type: "return", value: "6!" },
                    { type: "return", value: "25 woaw!" },
                ]);
            });
        });

        describe("CallExpression", () => {
            test("Without args", () => {
                const foo = vi.fn();

                ExpressionOf(`bar.foo()`, 30, { bar: { foo: () => 10 * 3 } });
                ExpressionOf(`bar.foo()`, undefined, { bar: { foo } });

                expect(foo).toHaveBeenCalledOnce();
            });

            test("With one arg", () => {
                const foo = vi.fn((a) => a * 10);

                ExpressionOf(`bar.foo(10)`, 100, { bar: { foo } });
                ExpressionOf(`bar.foo("5")`, 50, { bar: { foo } });

                expect(foo).toHaveBeenCalledTimes(2);
                expect(foo.mock.results).toEqual([
                    { type: "return", value: 100 },
                    { type: "return", value: 50 },
                ]);
            });

            test("With many args", () => {
                const foo = vi.fn((a, b, suffix = "!") => a * b + suffix);

                ExpressionOf(`bar.foo(10, 10)`, "100!", { bar: { foo } });
                ExpressionOf(`bar.foo(3, 2)`, "6!", { bar: { foo } });
                ExpressionOf(`bar.foo(5, 5, " woaw!")`, "25 woaw!", {
                    bar: { foo },
                });

                expect(foo).toHaveBeenCalledTimes(3);
                expect(foo.mock.results).toEqual([
                    { type: "return", value: "100!" },
                    { type: "return", value: "6!" },
                    { type: "return", value: "25 woaw!" },
                ]);
            });
        });

        describe("UnaryExpression", () => {
            test("-", () => {
                ExpressionOf("-foo", 10, { foo: -10 });
                ExpressionOf("-foo", -30, { foo: 30 });
            });

            test("+", () => {
                ExpressionOf("+foo", 10, { foo: "10" });
                ExpressionOf("+foo", NaN, { foo: "hello" });
            });

            test("not", () => {
                ExpressionOf("not foo", true, { foo: false });
                ExpressionOf("not foo", false, { foo: true });
            });
        });

        describe("MemberExpression", () => {
            test("one property", () => {
                ExpressionOf("foo.bar", "hello world!", {
                    foo: { bar: "hello world!" },
                });
            });

            test("one computed property", () => {
                ExpressionOf("foo['b' ~ 'ar']", "joe", {
                    foo: { bar: "joe" },
                });

                ExpressionOf("foo[2 * 5]", "joe", {
                    foo: { 10: "joe" },
                });

                ExpressionOf("foo[bar]", "insane_value", {
                    foo: { _secret_key_: "insane_value" },
                    bar: "_secret_key_",
                });
            });
        });

        describe("InExpression", () => {
            test("in array", () => {
                ExpressionOf("foo in array", true, {
                    foo: 42,
                    array: [1, 17, 42, 5],
                });

                ExpressionOf("foo in array", false, {
                    foo: 42,
                    array: [1, 17, 5],
                });
            });

            test("in object", () => {
                ExpressionOf("key in object", true, {
                    key: "foo",
                    object: {
                        stuff: "value",
                        foo: undefined,
                    },
                });

                ExpressionOf("key in object", false, {
                    key: "foo",
                    object: {
                        stuff: "value",
                    },
                });
            });

            test("not in array", () => {
                ExpressionOf("foo not in array", false, {
                    foo: 42,
                    array: [1, 17, 42, 5],
                });

                ExpressionOf("foo not in array", true, {
                    foo: 42,
                    array: [1, 17, 5],
                });
            });

            test("not in object", () => {
                ExpressionOf("key not in object", false, {
                    key: "foo",
                    object: {
                        stuff: "value",
                        foo: undefined,
                    },
                });

                ExpressionOf("key not in object", true, {
                    key: "foo",
                    object: {
                        stuff: "value",
                    },
                });
            });
        });

        describe("IsExpression", () => {
            test("is (not)? null", () => {
                ExpressionOf("foo is null", true, { foo: null });
                ExpressionOf("foo is null", false);

                ExpressionOf("foo is not null", false, { foo: null });
                ExpressionOf("foo is not null", true);
            });

            test("is (not)? empty", () => {
                function validate(not = false) {
                    const expression = `foo is${not ? " not" : ""} empty`;

                    ExpressionOf(expression, !not);
                    ExpressionOf(expression, !not, { foo: null });
                    ExpressionOf(expression, !not, { foo: "" });
                    ExpressionOf(expression, !not, { foo: 0 });
                    ExpressionOf(expression, !not, { foo: [] });
                    ExpressionOf(expression, !not, { foo: {} });

                    ExpressionOf(expression, not, { foo: "null" });
                    ExpressionOf(expression, not, { foo: "value" });
                    ExpressionOf(expression, not, { foo: 10 });
                    ExpressionOf(expression, not, { foo: -10 });
                    ExpressionOf(expression, not, { foo: ["value"] });
                    ExpressionOf(expression, not, { foo: { key: "value" } });
                }

                validate(false);
                validate(true);
            });

            test("is (not)? defined", () => {
                ExpressionOf("foo is defined", false);
                ExpressionOf("foo is defined", true, { foo: undefined });
                ExpressionOf("foo is defined", true, { foo: 10 });

                ExpressionOf("foo is not defined", true);
                ExpressionOf("foo is not defined", false, { foo: undefined });
                ExpressionOf("foo is not defined", false, { foo: 10 });
            });

            test.fails("is (not)? defined should only be on identifiers", () =>
                ExpressionOf("foo.bar is defined", null)
            );

            test.fails("should fail if unknown identifier found", () => {
                ExpressionOf("foo is something", null);
            });

            test.fails("should fail if unknown expression found", () => {
                ExpressionOf("foo is 10", null);
            });
        });

        describe("ArrowFunctionExpression", () => {
            test("without args", () => {
                ExpressionOf("() => null", (/** @type {any} */ value) => {
                    expect(value).toBeTypeOf("function");
                    expect(value).toBeInstanceOf(Function);
                    expect(value()).toBeNull();
                });

                ExpressionOf("() => 2 * 5", (/** @type {any} */ value) => {
                    expect(value).toBeTypeOf("function");
                    expect(value).toBeInstanceOf(Function);
                    expect(value()).toBe(10);
                });
            });

            test("with one arg", () => {
                ExpressionOf(
                    "(arg) => arg ~ '!'",
                    (/** @type {any} */ value) => {
                        expect(value).toBeTypeOf("function");
                        expect(value).toBeInstanceOf(Function);
                        expect(value()).toBe("undefined!");
                        expect(value("Hello")).toBe("Hello!");
                    }
                );

                ExpressionOf(
                    "arg => 2 * 5 + arg",
                    (/** @type {any} */ value) => {
                        expect(value).toBeTypeOf("function");
                        expect(value).toBeInstanceOf(Function);
                        expect(value()).toBe(NaN);
                        expect(value(10)).toBe(20);
                    }
                );
            });

            test("with many args", () => {
                ExpressionOf(
                    "(arg1, arg2, arg3) => arg1 + arg2 * arg3",
                    (/** @type {any} */ value) => {
                        expect(value).toBeTypeOf("function");
                        expect(value).toBeInstanceOf(Function);
                        expect(value(1, 2, 3)).toBe(7);
                        expect(value(3, 2, 1)).toBe(5);
                    }
                );
            });
        });

        describe("chainable expression", () => {
            test("mega complex", () => {
                // The most complex expression just for fun

                const theAnswerToAll = 42;

                ExpressionOf(
                    "foo.bar()[10]|filter|test('hello').why['so' ~ long]()",
                    theAnswerToAll,
                    {
                        foo: {
                            bar: () => {
                                return {
                                    10: "_secret_value_",
                                };
                            },
                        },
                        /**
                         * @param {string} value
                         */
                        filter(value) {
                            return [...value]
                                .map((c) => c.charCodeAt(0))
                                .reduce((a, n) => a + n, 0);
                        },
                        /**
                         * @param {number} number
                         * @param {string} value
                         */
                        test(number, value) {
                            number += [...value]
                                .map((c) => c.charCodeAt(0))
                                .reduce((a, n) => a + n, 0);

                            return {
                                why: {
                                    so_crazy: () => {
                                        const ns = String(number)
                                            .split("")
                                            .toReversed();
                                        ns.splice(1, 2);
                                        return +ns.join("");
                                    },
                                },
                            };
                        },
                        long: "_crazy",
                    }
                );
            });
        });

        describe("Precedence", () => {
            test("Multiplications / Divisions with Additions / Substractions", () => {
                ExpressionOf(`1 + 2 * 3`, 7);
                ExpressionOf(`1 * 2 + 3`, 5);

                ExpressionOf(`1 + 2 / 4`, 1.5);
                ExpressionOf(`1 / 2 + 4`, 4.5);

                ExpressionOf(`1 - 2 + 4 * 10 - 3 / 10`, 38.7);
            });

            test("Parenthezise", () => {
                ExpressionOf(`1 + 2 * 3`, 7);
                ExpressionOf(`(1 + 2) * 3`, 9);
            });
        });
    });

    describe.todo("Variable");

    describe.todo("HtmlTag");

    describe.todo("KeyBlock");

    describe.todo("ZvelteComponent");

    describe("Component", () => {
        describe("Attributes", () => {
            test.todo("Attribute");
            test.todo("Spread");
            describe("BindDirective", () => {
                test.todo("bind:this");
            });
            test.todo("OnDirective");
        });

        test.todo("Children");

        test.todo.fails("Component not found");
    });

    describe("Styling", () => {
        test("should scope to only one component", () => {
            createComponent({
                key: "Sub",
                ast: parse(`<p>Sub paragraph</p>`),
            });

            currentInstance = mount({
                target: document.body,
                source: `<p>Paragraph</p> <zvelte key="Sub" /> <style>p { color: red; }</style>`,
            });

            expect(document.body.children).toHaveLength(2);

            const p = document.body.children[0];
            const zvelte = document.body.children[1];

            expect(p.nodeName).toBe("P");
            expect(p.attributes).toHaveLength(1);
            expect(p.hasAttribute("class")).toBe(true);

            expect(window.getComputedStyle(p).color).toBe("rgb(255, 0, 0)");

            expect(zvelte.nodeName).toBe("ZVELTE");
            expect(zvelte.children).toHaveLength(1);

            const subP = zvelte.children[0];

            expect(subP.nodeName).toBe("P");
            expect(subP.attributes).toHaveLength(0);

            expect(window.getComputedStyle(subP).color).toBe("rgb(0, 0, 0)");
        });

        test(":global()", () => {
            createComponent({
                key: "Sub",
                ast: parse(`<p>Sub paragraph</p>`),
            });

            currentInstance = mount({
                target: document.body,
                source: `<p>Paragraph</p> <zvelte key="Sub" /> <style>:global(p) { color: red; }</style>`,
            });

            expect(document.body.children).toHaveLength(2);

            const p = document.body.children[0];
            const zvelte = document.body.children[1];

            expect(p.nodeName).toBe("P");

            expect(window.getComputedStyle(p).color).toBe("rgb(255, 0, 0)");

            expect(zvelte.nodeName).toBe("ZVELTE");
            expect(zvelte.children).toHaveLength(1);

            const subP = zvelte.children[0];

            expect(subP.nodeName).toBe("P");
            expect(subP.attributes).toHaveLength(0);

            expect(window.getComputedStyle(subP).color).toBe("rgb(255, 0, 0)");
        });

        test("correctly add class id on already existing class", () => {
            currentInstance = mount({
                target: document.body,
                source: `<p class="foo">Paragraph</p> <style>p.foo { color: red; }</style>`,
            });

            expect(document.body.children).toHaveLength(1);

            const p = document.body.children[0];

            expect(p.nodeName).toBe("P");
            expect(p.attributes).toHaveLength(1);
            expect(p.classList).toHaveLength(2);
            expect(p.classList.contains("foo")).toBe(true);

            expect(window.getComputedStyle(p).color).toBe("rgb(255, 0, 0)");
        });

        test("correctly add class id on already existing class with expression only", () => {
            currentInstance = mount({
                target: document.body,
                source: `<p class="{{ 'foo' }}">Paragraph</p> <style>p.foo { color: red; }</style>`,
            });

            expect(document.body.children).toHaveLength(1);

            const p = document.body.children[0];

            expect(p.nodeName).toBe("P");
            expect(p.attributes).toHaveLength(1);
            expect(p.classList).toHaveLength(2);
            expect(p.classList.contains("foo")).toBe(true);

            expect(window.getComputedStyle(p).color).toBe("rgb(255, 0, 0)");
        });
    });
});
