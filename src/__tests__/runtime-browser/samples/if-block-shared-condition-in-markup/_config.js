import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo: false,
        };
    },

    html: "",

    async test({ props, target }) {
        for (let i = 0; i < 10; i++) {
            props.foo = true;
            await tick();
            expect(target.innerHTML).toEqual("true");

            props.foo = false;
            await tick();
            expect(target.innerHTML).toEqual("");
        }
    },
});
