import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    html: '<svg class="foo"></svg>',

    async test({ target }) {
        const svg = target.querySelector("svg");
        ok(svg);

        expect(svg.namespaceURI).toEqual("http://www.w3.org/2000/svg");
        expect(svg.getAttribute("class")).toEqual("foo");
    },
});
