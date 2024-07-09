import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    html: `<p>selected: one</p> <select><option>one</option><option>two</option><option>three</option></select> <p>selected: one</p>`,
    get props() {
        return { selected: "one" };
    },

    async test({ props, target }) {
        const select = target.querySelector("select");
        ok(select);

        const options = [...target.querySelectorAll("option")];

        expect(options).toEqual([...select.options]);
        expect(props.selected).toBe("one");

        const change = new window.Event("change");

        options[1].selected = true;
        select.dispatchEvent(change);
        await tick();

        expect(props.selected).toBe("two");
        expect(target.innerHTML).toEqual(
            `<p>selected: two</p> <select><option>one</option><option>two</option><option>three</option></select> <p>selected: two</p>`,
        );
        props.selected = "three";
        await tick();

        expect(target.innerHTML).toEqual(
            `<p>selected: three</p> <select><option>one</option><option>two</option><option>three</option></select> <p>selected: three</p>`,
        );
    },
});
