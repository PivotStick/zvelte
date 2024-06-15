import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest, ok } from "../../defineTest.js";

// @ts-ignore
import Foo from "./Foo.twig";
// @ts-ignore
import Bar from "./Bar.twig";

export default defineTest({
    get props() {
        return { x: true, y: undefined, z: undefined, Foo, Bar };
    },

    html: "<p>foo</p> <input><!---->",

    async test({ props, target }) {
        let input = target.querySelector("input");
        ok(input);

        input.value = "abc";
        input.dispatchEvent(new window.Event("input"));
        await tick();

        expect(props.y).toEqual("abc");

        props.x = false;
        await tick();

        expect(target.innerHTML).toEqual(
            '<p>bar</p> <input type="checkbox"><!---->'
        );

        input = target.querySelector("input");
        ok(input);

        input.checked = true;
        input.dispatchEvent(new window.Event("change"));
        await tick();

        expect(props.z).toEqual(true);
    },
});
