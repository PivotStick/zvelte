import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    // Test that template with sole script tag does execute when instantiated in the client.
    test({}) {
        // In here to give effects etc time to execute
        expect(window.document.body.innerHTML).toEqual(
            "this should be executed",
        );
    },
});
