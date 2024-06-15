import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    test({ target }) {
        const [control, test] = target.querySelectorAll("p");

        expect(window.getComputedStyle(control).color).toEqual("rgb(0, 0, 0)");
        expect(window.getComputedStyle(test).color).toEqual("rgb(255, 0, 0)");
    },
});
