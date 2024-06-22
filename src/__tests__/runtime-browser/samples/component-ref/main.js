import { onMount } from "../../../../internal/client/index.js";

/**
 * @param {import("@pivotass/zvelte").Args<any>} args
 */
export default function init({ props, els }) {
    onMount(() => {
        props.widget = els.widget;
    });
}
