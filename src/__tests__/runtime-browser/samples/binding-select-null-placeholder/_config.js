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

        expect(options[0].selected).toEqual(true);
        expect(options[0].disabled).toEqual(true);
        expect(options[1].selected).toEqual(false);
        expect(options[1].disabled).toEqual(false);

        // placeholder option value must be blank string for native required field validation
        expect(options[0].value).toEqual("");
        expect(select.checkValidity()).toEqual(false);

        props.foo = props.items[0];
        await tick();

        expect(options[0].selected).toEqual(false);
        expect(options[1].selected).toEqual(true);
        expect(select.checkValidity()).toEqual(true);
    },
});
