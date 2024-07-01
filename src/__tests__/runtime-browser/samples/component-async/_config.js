import { expect, vi } from "vitest";
import { defineTest, wait } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

const _fetch = vi.fn(async (endpoint, init) => {
    await wait(200);
    return {
        ok: true,
        json() {
            return { endpoint, init };
        },
    };
});

export default defineTest({
    before() {
        vi.stubGlobal("fetch", _fetch);
    },

    after() {
        _fetch.mockRestore();
        vi.unstubAllGlobals();
    },

    compilerOptions: {
        async: {
            endpoint: "/foo",
        },
    },

    html: "",

    get props() {
        return {
            data: {
                id: 10,
            },
        };
    },

    async test({ props, target }) {
        expect(_fetch.mock.calls).toEqual([
            ["/foo?id=10", { headers: { accept: "application/json" } }],
        ]);

        expect(props).toEqual({ data: { id: 10 } });

        await wait(200);
        await tick();

        const expectedReturn = {
            endpoint: "/foo?id=10",
            init: {
                headers: {
                    accept: "application/json",
                },
            },
        };

        expect(target.innerHTML).toEqual(
            `main\n\n${JSON.stringify(expectedReturn)}`,
        );
    },
});
