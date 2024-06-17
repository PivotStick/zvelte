import { onMount } from "@pivotass/zvelte";

/**
 * @param {import('@pivotass/zvelte').Args<{ test: any }>} args
 */
export default function init({ props, els }) {
    onMount(() => {
        props.test = els.test;
    });
}
