import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            empty: undefined,
            oneElement: undefined,
            trailing: undefined,
            manyElements: undefined,
        };
    },
    test({ props }) {
        expect(props.empty).toEqual([]);
        expect(props.oneElement).toEqual(["foo"]);
        expect(props.trailing).toEqual(["foo"]);
        expect(props.manyElements).toEqual([
            "foo",
            "bar",
            [true, 8],
            { object: "value" },
        ]);
    },
});
