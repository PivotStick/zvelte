import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    props: { output: undefined },
    test({ props }) {
        expect(props.output).toEqual(null);
    },
});
