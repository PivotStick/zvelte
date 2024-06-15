import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    get props() {
        return { inert: true };
    },
    async test({ target, props }) {
        const div = target.querySelector("div");
        ok(div);
        expect(div.inert).toBe(true);
        props.inert = false;
        await tick();
        expect(div.inert).toBe(false);
    },
});
