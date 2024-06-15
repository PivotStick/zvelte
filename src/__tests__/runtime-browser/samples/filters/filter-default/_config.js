import { expect } from "vitest";
import { tick } from "../../../../../internal/client/index.js";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            value: /** @type {any} */ (20),
            get() {
                return false;
            },
        };
    },

    html: "foo true 20 false",

    async test({ props, target }) {
        props.value = undefined;
        await tick();

        expect(target.innerHTML).toBe("foo true foo false");
    },
});
