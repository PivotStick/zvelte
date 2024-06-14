import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    html: '<textarea readonly="" data-attr="true"></textarea>',
    test({ target }) {
        const textarea = target.querySelector("textarea");
        ok(textarea);
        expect(textarea.dataset.attr).toBe("true");
        expect(textarea.readOnly).toBe(true);
    },
});
