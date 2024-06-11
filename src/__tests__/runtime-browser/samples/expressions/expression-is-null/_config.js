import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo1: null,
            foo3: null,

            output1: undefined,
            output2: undefined,
            output3: undefined,
            output4: undefined,
        };
    },

    async test({ props }) {
        expect(props.output1).toEqual(true);
        expect(props.output2).toEqual(false);
        expect(props.output3).toEqual(false);
        expect(props.output4).toEqual(true);
    },
});
