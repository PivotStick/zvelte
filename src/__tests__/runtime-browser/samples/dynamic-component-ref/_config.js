import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

// @ts-expect-error
import Foo from "./Foo.zvelte";

export default defineTest({
    get props() {
        /** @type {any} */
        let test;
        return {
            Foo,
            get test() {
                return test;
            },
            set test(v) {
                test = v;
            },
        };
    },

    html: "Foo",

    async test({ props }) {
        await tick();
        expect(props.test).toBe("hello from foo");
    },
});
