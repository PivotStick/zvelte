import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    test({}) {
        document.dispatchEvent(new Event("DOMContentLoaded"));
        expect(window.document.querySelector("button")?.textContent).toEqual(
            "Hello world",
        );
    },
});
