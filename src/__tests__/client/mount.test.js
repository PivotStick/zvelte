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

    test("snippet block with render tag", () => {
        mount({
            target: document.body,
            source: "{% snippet foo() %}Hello Component!{% endsnippet %}{{ @render foo() }}",
        });

        expect(document.body.textContent).toBe("Hello Component!");
    });

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

        mount({
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
