import { expect, vi } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            bar: { foo: vi.fn((a) => a * 10) },

            output1: undefined,
            output2: undefined,
        };
    },

    test({ props }) {
        expect(props.output1).toBe(100);
        expect(props.output2).toBe(50);

        expect(props.bar.foo).toHaveBeenCalledTimes(2);
        expect(props.bar.foo.mock.results).toEqual([
            { type: "return", value: 100 },
            { type: "return", value: 50 },
        ]);
    },
});
