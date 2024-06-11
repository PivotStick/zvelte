import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            output1: undefined,
            output2: undefined,

            output3: undefined,
            output4: undefined,

            output5: undefined,
            output6: undefined,

            foo1: -10,
            foo2: 30,
            foo3: "10",
            foo4: "hello",
            foo5: false,
            foo6: true,
        };
    },

    test({ props }) {
        expect(props.output1).toEqual(10);
        expect(props.output2).toEqual(-30);

        expect(props.output3).toEqual(10);
        expect(props.output4).toEqual(NaN);

        expect(props.output5).toEqual(true);
        expect(props.output6).toEqual(false);
    },
});
