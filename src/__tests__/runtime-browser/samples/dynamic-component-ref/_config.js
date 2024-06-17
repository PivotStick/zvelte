import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

// @ts-expect-error
import Foo from "./Foo.twig";

export default defineTest({
    get props() {
        return {
            Foo,
            test: /** @type {any} */ (undefined),
        };
    },

    html: "Foo<!---->",

    async test({ props }) {
        await tick();
        expect(props.test).toBe("hello from foo");
    },
});
