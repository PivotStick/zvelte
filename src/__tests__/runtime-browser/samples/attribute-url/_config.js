import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    todo: true,

    test({ target }) {
        const div = target.querySelector("div");
        ok(div);

        expect(div.style.backgroundImage).toEqual(
            "url(https://example.com/foo.jpg)"
        );
        expect(div.style.color).toEqual("lol");
    },
});
