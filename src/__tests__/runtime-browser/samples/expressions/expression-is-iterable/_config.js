import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo1: [],
            foo3: null,
            foo5: new Map(),
            foo6: { [Symbol.iterator]() {} },

            output1: undefined,
            output2: undefined,
            output3: undefined,
            output4: undefined,
            output5: undefined,
            output6: undefined,
        };
    },

    async test({ props }) {
        expect(props.output1, "output1").toEqual(true);
        expect(props.output2, "output2").toEqual(false);
        expect(props.output3, "output3").toEqual(true);
        expect(props.output4, "output4").toEqual(true);
        expect(props.output5, "output5").toEqual(true);
        expect(props.output6, "output6").toEqual(true);
    },
});
