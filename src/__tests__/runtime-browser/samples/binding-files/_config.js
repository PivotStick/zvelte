import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    async test({ target }) {
        const input = target.querySelector("input");

        await new Promise((r) => setTimeout(r, 100));
        expect(input?.files?.length).toEqual(1);
        target.querySelector("button")?.click();

        await new Promise((r) => setTimeout(r, 100));
        expect(input?.files?.length).toEqual(0);
    },
});
