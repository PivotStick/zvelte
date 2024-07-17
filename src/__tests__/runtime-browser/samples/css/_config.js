import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    async test({ target }) {
        await tick();
        const [control, test] = target.querySelectorAll("p");

        expect(window.getComputedStyle(control).color).toEqual("rgb(0, 0, 0)");
        expect(window.getComputedStyle(test).color).toEqual("rgb(255, 0, 0)");
    },
});
