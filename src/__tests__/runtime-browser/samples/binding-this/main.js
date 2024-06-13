import { onMount } from "../../../../internal/client/index.js";

/**
 * @param {import("@pivotass/zvelte").Args<{ canvas: HTMLCanvasElement | undefined }, {
 *  canvas: HTMLCanvasElement;
 * }>} args
 */
export default function init({ props, els }) {
    onMount(() => {
        props.canvas = els.canvas;
    });
}
