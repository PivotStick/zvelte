import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

let count = 0;

export default defineTest({
    get props() {
        return {
            foo: "potato",
            fn: () => {
                count += 1;
                return true;
            },
        };
    },

    html: "<!----><p>potato</p>",

    before() {
        count = 0;
    },

    async test({ props, target }) {
        expect(count).toBe(1);

        props.foo = "soup";
        await tick();
        expect(count).toBe(1);
        expect(target.innerHTML).toEqual("<!----><p>soup</p>");
    },
});
