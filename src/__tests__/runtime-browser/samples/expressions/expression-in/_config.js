import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo1: 42,
            array1: [1, 17, 42, 5],

            foo2: 42,
            array2: [1, 17, 5],

            key1: "foo",
            object1: {
                stuff: "value",
                foo: undefined,
            },

            key2: "foo",
            object2: {
                stuff: "value",
            },

            foo3: 42,
            array3: [1, 17, 42, 5],

            foo4: 42,
            array4: [1, 17, 5],

            key3: "foo",
            object3: {
                stuff: "value",
                foo: undefined,
            },

            key4: "foo",
            object4: {
                stuff: "value",
            },

            output1: undefined,
            output2: undefined,
            output3: undefined,
            output4: undefined,
            output5: undefined,
            output6: undefined,
            output7: undefined,
            output8: undefined,
        };
    },

    async test({ props }) {
        expect(props.output1).toEqual(true);
        expect(props.output2).toEqual(false);
        expect(props.output3).toEqual(true);
        expect(props.output4).toEqual(false);
        expect(props.output5).toEqual(false);
        expect(props.output6).toEqual(true);
        expect(props.output7).toEqual(false);
        expect(props.output8).toEqual(true);
    },
});
