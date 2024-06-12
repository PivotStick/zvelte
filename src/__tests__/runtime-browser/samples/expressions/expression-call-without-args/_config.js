import { expect, vi } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        const foo = vi.fn();

        return {
            bar1: { foo: () => 10 * 3 },
            bar2: { foo },

            output1: undefined,
            output2: undefined,
        };
    },

    test({ props }) {
        expect(props.output1).toBe(30);
        expect(props.output2).toBe(undefined);

        expect(props.bar2.foo).toHaveBeenCalledOnce();
    },
});
