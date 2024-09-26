import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";

const realPromise = Promise.resolve(42);

const promise = () => {};
promise.then = realPromise.then.bind(realPromise);
promise.catch = realPromise.catch.bind(realPromise);

export default defineTest({
    get props() {
        return { promise };
    },

    async test({ target }) {
        await promise;
        expect(target.innerHTML).toEqual(`<!----><p>42</p>`);
    },
});
