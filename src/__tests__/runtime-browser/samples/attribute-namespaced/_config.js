import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    get props() {
        return { foo: "bar" };
    },

    html: '<svg><use xlink:href="#bar"></use></svg>',

    test({ target }) {
        const use = target.querySelector("use");
        ok(use);

        expect(
            use.getAttributeNS("http://www.w3.org/1999/xlink", "href")
        ).toEqual("#bar");
    },
});
