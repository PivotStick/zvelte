import { expect, vi } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        const foo = vi.fn();

        return {
            foo1: () => 10 * 3,
            foo2: foo,

            output1: undefined,
            output2: undefined,
        };
    },

    test({ props }) {
        expect(props.output1).toBe(30);
        expect(props.output2).toBe(undefined);

        expect(props.foo2).toHaveBeenCalledOnce();
    },
});
