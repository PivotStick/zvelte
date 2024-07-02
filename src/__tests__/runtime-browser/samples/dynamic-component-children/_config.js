import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

// @ts-ignore
import Foo from "./Foo.twig";
// @ts-ignore
import Bar from "./Bar.twig";

export default defineTest({
    get props() {
        return {
            Foo,
            Bar,
            x: true,
        };
    },

    html: [
        "<h1>Foo</h1>",
        "<div>what goes up must come down</div><!---->",
        "<p>element</p>",
        "you're it",
        "<p>neither foo nor bar</p><!---->",
        "text",
        "<span>a</span><span>b</span><span>c</span><!---->",
        "<div>baz</div><!----><!---->",
    ].join(" "),

    async test({ props, target }) {
        props.x = false;
        await tick();

        expect(target.innerHTML).toEqual(
            [
                "<h1>Bar</h1>",
                "<p>element</p>",
                "you're it",
                "<p>neither foo nor bar</p><!---->",
                "text",
                "<span>a</span><span>b</span><span>c</span><!---->",
                "<div>baz</div><!----><!---->",
                "<div>what goes up must come down</div><!---->",
            ].join(" "),
        );
    },
});
