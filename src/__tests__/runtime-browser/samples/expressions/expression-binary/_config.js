import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    props: {
        // outputs
        add1: undefined,
        add2: undefined,
        add3: undefined,
        add4: undefined,
        add5: undefined,
        add6: undefined,
        mult1: undefined,
        mult2: undefined,
        mult3: undefined,
        mult4: undefined,
        mult5: undefined,
        mult6: undefined,
        concat1: undefined,
        concat2: undefined,
        concat3: undefined,
        concat4: undefined,
        equal1: undefined,
        equal2: undefined,
        equal3: undefined,
        equal4: undefined,
        equal5: undefined,
        equal6: undefined,
        equal7: undefined,
        equal8: undefined,
        equal9: undefined,
        equal10: undefined,
        equal11: undefined,
        equal12: undefined,
        equal13: undefined,
        equal14: undefined,
        equal15: undefined,
        equal16: undefined,

        // values
        foo1: "50",
        bar1: "40",
        foo2: "Hello",
        foo3: 50,
        bar2: 40,
    },
    test({ props }) {
        expect(props.add1).toEqual(2);
        expect(props.add2).toEqual(84);
        expect(props.add3).toEqual(0);
        expect(props.add4).toEqual(-56);
        expect(props.add5).toEqual(3);
        expect(props.add6).toEqual(90);

        expect(props.mult1).toEqual(2);
        expect(props.mult2).toEqual(680);
        expect(props.mult3).toEqual(0.5);
        expect(props.mult4).toEqual(1);
        expect(props.mult5).toEqual(0);
        expect(props.mult6).toEqual(Infinity);

        expect(props.concat1).toEqual("Hello world!");
        expect(props.concat2).toEqual("undefined world!");
        expect(props.concat3).toEqual("12");
        expect(props.concat4).toEqual("5040");

        expect(props.equal1).toEqual(true);
        expect(props.equal2).toEqual(false);
        expect(props.equal3).toEqual(false);
        expect(props.equal4).toEqual(true);
        expect(props.equal5).toEqual(false);
        expect(props.equal6).toEqual(false);
        expect(props.equal7).toEqual(true);
        expect(props.equal8).toEqual(false);
        expect(props.equal9).toEqual(true);
        expect(props.equal10).toEqual(false);
        expect(props.equal11).toEqual(true);
        expect(props.equal12).toEqual(true);
        expect(props.equal13).toEqual(false);
        expect(props.equal14).toEqual(true);
        expect(props.equal15).toEqual(false);
        expect(props.equal16).toEqual(true);
    },
});
