import { onMount } from "@pivotass/zvelte";

/**
 * @param {import('@pivotass/zvelte').Args<{ test: any }>} args
 */
export default function init({ props, els }) {
    onMount(() => {
        console.log(els.test);
        props.test = els.test;
    });
}
