import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo1: { bar: "hello world!", other: { com: "stuff" } },
            foo2: { bar: "joe" },
            foo3: { 10: "joe" },
            foo4: { _secret_key_: "insane_value" },
            bar1: "_secret_key_",

            output1: undefined,
            output2: undefined,
            output3: undefined,
            output4: undefined,
            output5: undefined,
        };
    },

    async test({ props }) {
        expect(props.output1).toEqual("hello world!");
        expect(props.output2).toEqual("joe");
        expect(props.output3).toEqual("joe");
        expect(props.output4).toEqual("insane_value");
        expect(props.output5).toEqual("stuff");
    },
});
