import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo: /** @type {any} */ (null),
        };
    },

    html: "foo is ",

    async test({ props, target }) {
        props.foo = 42;
        await tick();
        expect(target.innerHTML).toBe("foo is 42");

        props.foo = null;
        await tick();
        expect(target.innerHTML).toBe("foo is ");
    },
});

export * as component from "./main.twig";
