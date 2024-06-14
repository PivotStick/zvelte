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
            });
        });
    });

    describe("ForBlock", () => {
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
                        <h1 on:click="{{ () => open(section) }}">{{ section.name }} {{ section.selected|length }} / {{ section.roles|length }} <div class="bar" /></h1>
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

            expect(document.body.innerHTML).toEqual(
                `<p class="zvelte-14l9336">Paragraph</p> <p>Sub paragraph</p><!---->`
            );

            const [p, subP] = document.body.querySelectorAll("p");

            expect(window.getComputedStyle(p).color).toBe("rgb(255, 0, 0)");
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

            expect(document.body.innerHTML).toEqual(
                `<p class="zvelte-xms5ti">Paragraph</p> <p>Sub paragraph</p><!---->`
            );

            const [p, subP] = document.body.querySelectorAll("p");

            expect(window.getComputedStyle(p).color).toBe("rgb(255, 0, 0)");
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

        test("ignores keyframes for now", () => {
            currentInstance = mount({
                target: document.body,
                source: `
                    <style>
                        @keyframes foo {
                            from 0% { color: red; }
                            to 100% { color: blue; }
                        }
                    </style>
                `,
            });

            let styleContent;

            for (const style of document.styleSheets) {
                if (
                    style.ownerNode instanceof HTMLStyleElement &&
                    style.ownerNode.id === "zvelte-qe9aa3"
                ) {
                    styleContent = style.ownerNode.textContent;
                    break;
                }
            }

            expect(styleContent).toBe(
                `@keyframes foo{from 0%{color:red}to 100%{color:blue}}`
            );
        });
    });
});
