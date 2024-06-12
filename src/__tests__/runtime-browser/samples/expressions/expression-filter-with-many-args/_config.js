import { expect, vi } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        const foo = vi.fn((a, b, suffix = "!") => a * b + suffix);

        return {
            foo,

            output1: undefined,
            output2: undefined,
            output3: undefined,
        };
    },

    test({ props }) {
        expect(props.output1).toBe("100!");
        expect(props.output2).toBe("6!");
        expect(props.output3).toBe("25 woaw!");

        expect(props.foo).toHaveBeenCalledTimes(3);
        expect(props.foo.mock.results).toEqual([
            { type: "return", value: "100!" },
            { type: "return", value: "6!" },
            { type: "return", value: "25 woaw!" },
        ]);
    },
});
