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
        };
    },
    test({ props }) {
        expect(props.output1, "output1").toEqual([2, 3]);
        expect(props.output2, "output2").toEqual("23");
        expect(props.output3, "output3").toEqual("12");
        expect(props.output4, "output4").toEqual("345");
        expect(props.output5, "output5").toEqual("123");
    },
});
