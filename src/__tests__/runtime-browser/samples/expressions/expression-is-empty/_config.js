import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo2: null,
            foo3: "",
            foo4: 0,
            foo5: [],
            foo6: {},
            foo7: "null",
            foo8: "value",
            foo9: 10,
            foo10: -10,
            foo11: ["value"],
            foo12: { key: "value" },

            output1: undefined,
            output2: undefined,
            output3: undefined,
            output4: undefined,
            output5: undefined,
            output6: undefined,
            output7: undefined,
            output8: undefined,
            output9: undefined,
            output10: undefined,
            output11: undefined,
            output12: undefined,
            output13: undefined,
            output14: undefined,
            output15: undefined,
            output16: undefined,
            output17: undefined,
            output18: undefined,
            output19: undefined,
            output20: undefined,
            output21: undefined,
            output22: undefined,
            output23: undefined,
            output24: undefined,
        };
    },

    async test({ props }) {
        expect(props.output1).toEqual(true);
        expect(props.output2).toEqual(true);
        expect(props.output3).toEqual(true);
        expect(props.output4).toEqual(true);
        expect(props.output5).toEqual(true);
        expect(props.output6).toEqual(true);

        expect(props.output7).toEqual(false);
        expect(props.output8).toEqual(false);
        expect(props.output9).toEqual(false);
        expect(props.output10).toEqual(false);
        expect(props.output11).toEqual(false);
        expect(props.output12).toEqual(false);

        expect(props.output13).toEqual(false);
        expect(props.output14).toEqual(false);
        expect(props.output15).toEqual(false);
        expect(props.output16).toEqual(false);
        expect(props.output17).toEqual(false);
        expect(props.output18).toEqual(false);

        expect(props.output19).toEqual(true);
        expect(props.output20).toEqual(true);
        expect(props.output21).toEqual(true);
        expect(props.output22).toEqual(true);
        expect(props.output23).toEqual(true);
        expect(props.output24).toEqual(true);
    },
});
