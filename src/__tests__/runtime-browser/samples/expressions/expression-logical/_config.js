import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            or1: undefined,
            or2: undefined,
            or3: undefined,
            or4: undefined,

            and1: undefined,
            and2: undefined,
            and3: undefined,
            and4: undefined,

            nullish1: undefined,
            nullish2: undefined,
            nullish3: undefined,
        };
    },
    test({ props }) {
        expect(props.or1).toEqual("yes");
        expect(props.or2).toEqual("yes");
        expect(props.or3).toEqual("stuff");
        expect(props.or4).toEqual("stuff");

        expect(props.and1).toEqual("yes");
        expect(props.and2).toEqual("");
        expect(props.and3).toEqual("");
        expect(props.and4).toEqual(false);

        expect(props.nullish1).toEqual(false);
        expect(props.nullish2).toEqual("bar");
        expect(props.nullish3).toEqual("bar");
    },
});
