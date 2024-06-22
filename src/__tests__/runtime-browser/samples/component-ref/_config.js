import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    html: "<div><p>i am a widget</p><!----></div>",

    test({ props }) {
        expect(props.widget.isWidget).toBe(true);
    },
});
