import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return { id: "foo" };
    },

    html: '<div id="foo"></div>',

    async test({ props, target }) {
        props.id = "bar";
        await tick();
        expect(target.innerHTML).toEqual('<div id="bar"></div>');
    },
});
