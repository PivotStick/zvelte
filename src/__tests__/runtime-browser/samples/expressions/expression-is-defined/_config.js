import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo: undefined,
            bar: 10,

            output1: undefined,
            output2: undefined,
            output3: undefined,
            output4: undefined,
            output5: undefined,
            output6: undefined,
        };
    },

    async test({ props }) {
        expect(props.output1).toEqual(false);
        expect(props.output2).toEqual(true);
        expect(props.output3).toEqual(true);
        expect(props.output4).toEqual(true);
        expect(props.output5).toEqual(false);
        expect(props.output6).toEqual(false);
    },
});
