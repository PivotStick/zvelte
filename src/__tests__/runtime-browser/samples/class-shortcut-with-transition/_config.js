import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return { open: false, border: true };
    },

    html: '<p class="zvelte-xf2vy">foo</p> <!---->',

    async test({ props, target, raf }) {
        props.open = true;
        await tick();

        raf.tick(100);
        expect(target.innerHTML, "first").toEqual(
            '<p class="zvelte-xf2vy">foo</p> <p class="red zvelte-xf2vy border" style="">bar</p><!---->'
        );

        props.open = false;
        await tick();

        raf.tick(150);
        expect(target.innerHTML).toEqual(
            '<p class="zvelte-xf2vy">foo</p> <p class="red zvelte-xf2vy border" style="overflow: hidden; opacity: 1; height: 2.5px; padding-top: 0px; padding-bottom: 0px; margin-top: 2px; margin-bottom: 2px; border-top-width: 0.5px; border-bottom-width: 0.5px;" inert="">bar</p><!---->'
        );

        props.open = true;
        await tick();

        raf.tick(250);
        expect(target.innerHTML).toEqual(
            '<p class="zvelte-xf2vy">foo</p> <p class="red zvelte-xf2vy border" style="">bar</p><!---->'
        );
    },
});
