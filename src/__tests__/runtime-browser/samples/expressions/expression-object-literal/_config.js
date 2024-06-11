import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    props: {
        // outputs
        empty: undefined,
        oneKey1: undefined,
        oneKey2: undefined,

        stringKey1: undefined,
        stringKey2: undefined,

        trailing: undefined,

        complex: undefined,

        // sample values
        bar1: undefined,
        bar2: "hello!",
    },
    test({ props }) {
        expect(props.empty).toEqual({});

        expect(props.oneKey1).toEqual({ foo: undefined });
        expect(props.oneKey2).toEqual({ foo: "hello!" });

        expect(props.stringKey1).toEqual({ foo: 6 });
        expect(props.stringKey2).toEqual({ foo: 6 });

        expect(props.trailing).toEqual({ foo: "stuff" });

        expect(props.complex).toEqual({
            foo: { bar: true, no: false },
            yes: "no",
            stuff: 1.5,
        });
    },
});
