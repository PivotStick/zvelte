import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            out1: undefined,
            out2: undefined,
            out3: undefined,
            out4: undefined,
            out5: undefined,
            out6: undefined,
            out7: undefined,
            out8: undefined,
        };
    },

    test({ props }) {
        expect(props.out1).toEqual(7);
        expect(props.out2).toEqual(5);
        expect(props.out3).toEqual(1.5);
        expect(props.out4).toEqual(4.5);
        expect(props.out5).toEqual(38.7);

        expect(props.out6).toEqual(7);
        expect(props.out7).toEqual(9);

        expect(props.out8).toEqual("foo8");
    },
});
