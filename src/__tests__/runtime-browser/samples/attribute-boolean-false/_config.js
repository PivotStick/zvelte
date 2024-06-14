import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    html: "<textarea></textarea>",
    test({ target }) {
        const textarea = target.querySelector("textarea");
        ok(textarea);
        expect(textarea.readOnly).toBe(false);
    },
});
