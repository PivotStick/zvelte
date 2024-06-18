import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return { foo: false };
    },

    async test({ props, target }) {
        const inputs = target.querySelectorAll("input");

        expect(inputs[0].checked).toEqual(true);
        expect(inputs[1].checked).toEqual(false);

        props.foo = true;
        await tick();

        expect(inputs[0].checked).toEqual(false);
        expect(inputs[1].checked).toEqual(true);
    },
});
