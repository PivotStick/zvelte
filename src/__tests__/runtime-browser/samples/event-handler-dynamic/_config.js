import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    html: "<p><button>set handler 1</button> <button>set handler 2</button></p> <p>0</p> <button>click</button>",

    async test({ target }) {
        const [updateButton1, updateButton2, button] =
            target.querySelectorAll("button");

        const event = new window.MouseEvent("click", { bubbles: true });
        let err = "";
        window.addEventListener("error", (e) => {
            e.preventDefault();
            err = e.message;
        });

        button.dispatchEvent(event);
        await tick();
        expect(err, err).toEqual("");
        expect(target.innerHTML).toEqual(
            "<p><button>set handler 1</button> <button>set handler 2</button></p> <p>0</p> <button>click</button>"
        );

        updateButton1.dispatchEvent(event);
        button.dispatchEvent(event);
        await tick();
        expect(target.innerHTML).toEqual(
            "<p><button>set handler 1</button> <button>set handler 2</button></p> <p>1</p> <button>click</button>"
        );

        updateButton2.dispatchEvent(event);
        button.dispatchEvent(event);
        await tick();
        expect(target.innerHTML).toEqual(
            "<p><button>set handler 1</button> <button>set handler 2</button></p> <p>2</p> <button>click</button>"
        );
    },
});
