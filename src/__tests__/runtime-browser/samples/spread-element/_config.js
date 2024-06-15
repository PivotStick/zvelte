import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return {
            props: /** @type {any} */ ({
                "data-foo": "bar",
                "data-named": "qux",
            }),
            color: "red",
        };
    },

    html: '<div data-foo="bar" data-named="value">red</div>',

    async test({ props, target }) {
        const div = target.querySelector("div");
        ok(div);

        expect(div.dataset.foo).toEqual("bar");
        expect(div.dataset.named).toEqual("value");

        props.color = "blue";
        props.props = { "data-foo": "baz", "data-named": "qux" };
        await tick();
        expect(target.innerHTML).toEqual(
            '<div data-foo="baz" data-named="value">blue</div>'
        );
        expect(div.dataset.foo).toEqual("baz");
        expect(div.dataset.named).toEqual("value");

        props.color = "blue";
        props.props = {};
        await tick();
        expect(target.innerHTML).toEqual('<div data-named="value">blue</div>');
        expect(div.dataset.foo).toEqual(undefined);
    },
});
