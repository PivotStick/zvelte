import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount } from "./mount.js";
import { proxy, tick } from "../index.js";

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
    test("text", () => {
        currentInstance = mount({
            target: document.body,
            source: "Hello World",
        });

        expect(document.body.textContent).toEqual("Hello World");
    });

    test("comment", () => {
        currentInstance = mount({
            target: document.body,
            source: `<!-- hello! -->`,
        });

        const comment = /** @type {Comment} */ (document.body.childNodes[0]);

        expect(comment).toBeInstanceOf(Comment);
        expect(comment.data).toBe(" hello! ");
    });

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
        test("element", () => {
            currentInstance = mount({
                target: document.body,
                source: "<h1></h1>",
            });

            const h1 = document.body.querySelector("h1");

            expect(h1).not.toBeNull();
            expect(h1?.innerText).toEqual("");
            expect(h1?.attributes.length).toEqual(0);
        });

        test("self closing element", () => {
            currentInstance = mount({
                target: document.body,
                source: "<h1 />",
            });

            const h1 = document.body.querySelector("h1");

            expect(h1).not.toBeNull();
            expect(h1?.innerText).toEqual("");
            expect(h1?.attributes.length).toEqual(0);
        });

        test("element with text", () => {
            currentInstance = mount({
                target: document.body,
                source: "<h1>Hello World!</h1>",
            });

            const h1 = document.body.querySelector("h1");

            expect(h1).not.toBeNull();
            expect(h1?.innerText).toEqual("Hello World!");
        });

        test("element with children", () => {
            currentInstance = mount({
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

    test("text with first prop", () => {
        currentInstance = mount({
            target: document.body,
            props: { name: "Joe" },
            source: "<h1>Hello {{ name }}!</h1>",
        });

        expect(document.body.querySelector("h1")).not.toBeNull();
        expect(document.body.textContent).toEqual("Hello Joe!");
    });

    test("counter button", async () => {
        currentInstance = mount({
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

        expect(button).toBeInstanceOf(HTMLButtonElement);

        for (let i = 0; i < 10; i++) {
            expect(button.textContent).toEqual(`clicks: ${i}`);
            button.click();
            await tick();
        }
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
        test("without args and render tag", () => {
            currentInstance = mount({
                target: document.body,
                source: "{% snippet foo() %}Hello Component!{% endsnippet %}{{ @render foo() }}",
            });

            expect(document.body.textContent).toBe("Hello Component!");
        });

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

        describe("NumericLiteral", () => {
            test("integer", () => {
                ExpressionOf("4", 4);
                ExpressionOf("2340", 2340);
                ExpressionOf("800000", 800000);
                ExpressionOf("+20", 20);
            });

            test("float", () => {
                ExpressionOf("0.003", 0.003);
                ExpressionOf("495.8837", 495.8837);
                ExpressionOf("3.14", 3.14);
                ExpressionOf("+40.00", 40);
            });

            test("negative integer", () => {
                ExpressionOf("-4", -4);
                ExpressionOf("-2340", -2340);
                ExpressionOf("-800000", -800000);
                ExpressionOf("-20", -20);
            });

            test("negative float", () => {
                ExpressionOf("-0.003", -0.003);
                ExpressionOf("-495.8837", -495.8837);
                ExpressionOf("-3.14", -3.14);
                ExpressionOf("-40.00", -40);
            });
        });

        describe("NullLiteral", () => {
            test("null", () => {
                ExpressionOf("null", null);
            });
        });

        describe("BooleanLiteral", () => {
            test("true", () => ExpressionOf("true", true));
            test("false", () => ExpressionOf("false", false));
        });

        describe("StringLiteral", () => {
            test("single quotes", () => {
                ExpressionOf("'hello world!'", "hello world!");
            });

            test("double quotes", () => {
                ExpressionOf(`"hello world!"`, "hello world!");
            });
        });

        test("Identifier", () => {
            currentInstance = mount({
                target: document.body,
                props: { foo: "bar" },
                source: `{{ foo }}`,
            });

            expect(document.body.textContent).toBe("bar");
        });

        describe("LogicalExpressions", () => {
            // "||" | "or" | "and" | "??";

            test("|| - or", () => {
                ExpressionOf("foo || bar", "yes", { foo: false, bar: "yes" });
                ExpressionOf("foo or bar", "yes", { foo: false, bar: "yes" });

                ExpressionOf("foo || bar", "stuff", {
                    foo: "stuff",
                    bar: "yes",
                });
                ExpressionOf("foo or bar", "stuff", {
                    foo: "stuff",
                    bar: "yes",
                });
            });

            test("and", () => {
                ExpressionOf("foo and bar", "yes", {
                    foo: "stuff",
                    bar: "yes",
                });
                ExpressionOf("foo and bar", "", { foo: "", bar: "yes" });
                ExpressionOf("foo and bar", "", { foo: "stuff", bar: "" });
                ExpressionOf("foo and bar", false, { foo: false, bar: false });
            });

            test("??", () => {
                ExpressionOf("foo ?? bar", false, { foo: false, bar: "bar" });
                ExpressionOf("foo ?? bar", "bar", { foo: null, bar: "bar" });
                ExpressionOf("foo ?? bar", "bar", { bar: "bar" });
            });
        });

        describe("BinaryExpressions", () => {
            // "+" | "-" | "/" | "*" | "~" | "==" | "!=" | "<=" | ">=" | "<" | ">";

            test("Additions & Substractions (+, -)", () => {
                ExpressionOf(`1 + 1`, 2);
                ExpressionOf(`14 + 20 + 50`, 84);

                ExpressionOf(`1 - 1`, 0);
                ExpressionOf(`14 - 20 - 50`, -56);
            });

            test("Concatenations are for numbers only", () => {
                ExpressionOf("'1' + '2'", 3);
                ExpressionOf("foo + bar", 90, { foo: "50", bar: "40" });
            });

            test("Divisions & Multiplications (/, *)", () => {
                ExpressionOf(`1 * 2`, 2);
                ExpressionOf(`34 * 20`, 680);

                ExpressionOf(`1 / 2`, 0.5);
                ExpressionOf(`20 / 20`, 1);
                ExpressionOf(`0 / 20`, 0);
                ExpressionOf(`20 / 0`, Infinity);
            });

            test("Concatenations (~)", () => {
                ExpressionOf(`foo ~ " world!"`, "Hello world!", {
                    foo: "Hello",
                });

                ExpressionOf(`foo ~ " world!"`, "undefined world!");
            });

            test("Concatenations are for strings only", () => {
                ExpressionOf("1 ~ 2", "12");
                ExpressionOf("foo ~ bar", "5040", { foo: 50, bar: 40 });
            });

            test("Equality & Greater/Lesser than (==, !=, <=, >=, <, >)", () => {
                ExpressionOf(`1 == 1`, true);
                ExpressionOf(`1 == 2`, false);

                ExpressionOf(`1 != 1`, false);
                ExpressionOf(`1 != 2`, true);

                ExpressionOf(`1 > 1`, false);
                ExpressionOf(`1 > 2`, false);
                ExpressionOf(`2 > 1`, true);

                ExpressionOf(`1 < 1`, false);
                ExpressionOf(`1 < 2`, true);
                ExpressionOf(`2 < 1`, false);

                ExpressionOf(`1 <= 1`, true);
                ExpressionOf(`1 <= 2`, true);
                ExpressionOf(`2 <= 1`, false);

                ExpressionOf(`1 >= 1`, true);
                ExpressionOf(`1 >= 2`, false);
                ExpressionOf(`2 >= 1`, true);
            });
        });

        describe("RangeExpression", () => {
            test("positive step", () => {
                ExpressionOf("0..10", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
                ExpressionOf("-5..1", [-5, -4, -3, -2, -1, 0]);
            });

            test("negative step", () => {
                ExpressionOf("10..0", [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
                ExpressionOf("-2..-5", [-2, -3, -4]);
            });
        });

        describe("ConditionalExpression", () => {
            test("consequent", () => {
                ExpressionOf("foo ? 'foo' : 'bar'", "bar", { foo: false });
            });

            test("alternate", () => {
                ExpressionOf("foo ? 'foo' : 'bar'", "foo", { foo: true });
            });
        });

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

        describe("ObjectExpression", () => {
            test("empty", () => {
                ExpressionOf("{}", {});
            });

            test("one key", () => {
                ExpressionOf("{ foo: bar }", { foo: undefined });
                ExpressionOf(
                    "{ foo: bar }",
                    { foo: "hello!" },
                    { bar: "hello!" }
                );
            });

            test("string as key", () => {
                ExpressionOf("{ 'foo': 2 * 3 }", { foo: 6 });
                ExpressionOf(`{ "foo": 2 * 3 }`, { foo: 6 });
            });

            test("trailing ','", () => {
                ExpressionOf("{ foo: 'stuff', }", { foo: "stuff" });
            });

            test("many properties with sub objects", () => {
                ExpressionOf(
                    `{foo: { bar: true, no: false }, 'yes': 'no', stuff: 3 * 0.5, }`,
                    {
                        foo: { bar: true, no: false },
                        yes: "no",
                        stuff: 1.5,
                    }
                );
            });
        });

        describe("ArrayExpression", () => {
            test("empty", () => {
                ExpressionOf("[]", []);
            });

            test("one element", () => {
                ExpressionOf("['foo']", ["foo"]);
            });

            test("trailing ','", () => {
                ExpressionOf(`['foo',]`, ["foo"]);
            });

            test("many elements", () => {
                ExpressionOf(
                    `['foo', 'bar', [true, 2 * 4], { object: "value"}]`,
                    ["foo", "bar", [true, 8], { object: "value" }]
                );
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
});
