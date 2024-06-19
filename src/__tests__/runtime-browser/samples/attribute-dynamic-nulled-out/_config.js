import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return {
            foo: /** @type {any} */ (undefined),
        };
    },

    html: "<div></div>",

    async test({ props, target }) {
        props.foo = "some value";
        await tick();
        expect(target.innerHTML).toEqual(`<div data-value="some value"></div>`);

        props.foo = null;
        await tick();
        expect(target.innerHTML).toEqual(`<div></div>`);

        props.foo = "another one";
        await tick();
        expect(target.innerHTML).toEqual(
            `<div data-value="another one"></div>`
        );

        props.foo = undefined;
        await tick();
        expect(target.innerHTML).toEqual(`<div></div>`);
    },
});
