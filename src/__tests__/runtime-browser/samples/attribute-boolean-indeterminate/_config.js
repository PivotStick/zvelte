import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    get props() {
        return { indeterminate: true };
    },

    async test({ props, target }) {
        const input = target.querySelector("input");
        ok(input);

        expect(input.indeterminate).toBe(true);
        props.indeterminate = false;
        await tick();
        expect(input.indeterminate).toBe(false);
    },
});
