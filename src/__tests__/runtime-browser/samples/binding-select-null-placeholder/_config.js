import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

const items = [{ id: "a" }, { id: "b" }];

export default defineTest({
    get props() {
        return {
            /** @type {{ id: string } | null} */
            foo: null,
            items,
        };
    },

    async test({ props, target }) {
        const select = target.querySelector("select");
        ok(select);

        const options = target.querySelectorAll("option");

        expect(options[0].selected, "01").toEqual(true);
        expect(options[0].disabled, "02").toEqual(true);
        expect(options[1].selected, "03").toEqual(false);
        expect(options[1].disabled, "04").toEqual(false);

        // placeholder option value must be blank string for native required field validation
        expect(options[0].value, "05").toEqual("");
        expect(select.checkValidity(), "06").toEqual(false);

        props.foo = props.items[0];
        await tick();

        expect(options[0].selected, "07").toEqual(false);
        expect(options[1].selected, "08").toEqual(true);
        expect(select.checkValidity(), "09").toEqual(true);
    },
});
