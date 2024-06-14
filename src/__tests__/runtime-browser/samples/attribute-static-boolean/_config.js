import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    html: '<textarea readonly=""></textarea>',
    test({ target }) {
        const textarea = target.querySelector("textarea");
        ok(textarea);
        expect(textarea.readOnly).toBe(true);
    },
});
