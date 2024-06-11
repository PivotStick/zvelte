import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    props: Object.fromEntries([
        ...Array.from(Array(8).keys()).map((_, i) => [
            `integer${i + 1}`,
            undefined,
        ]),
        ...Array.from(Array(8).keys()).map((_, i) => [
            `float${i + 1}`,
            undefined,
        ]),
    ]),

    test({ props }) {
        expect(props.integer1).toBe(4);
        expect(props.integer2).toBe(2340);
        expect(props.integer3).toBe(800000);
        expect(props.integer4).toBe(20);
        expect(props.integer5).toBe(-4);
        expect(props.integer6).toBe(-2340);
        expect(props.integer7).toBe(-800000);
        expect(props.integer8).toBe(-20);

        expect(props.float1).toBe(0.003);
        expect(props.float2).toBe(95.8837);
        expect(props.float3).toBe(3.14);
        expect(props.float4).toBe(40.0);
        expect(props.float5).toBe(-0.003);
        expect(props.float6).toBe(-495.8837);
        expect(props.float7).toBe(-3.14);
        expect(props.float8).toBe(-40.0);
    },
});
