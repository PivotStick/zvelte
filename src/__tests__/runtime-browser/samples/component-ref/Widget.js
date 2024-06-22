import { onMount } from "../../../../internal/client/index.js";

/**
 * @param {import("@pivotass/zvelte").Args<{
 *  isWidget: boolean;
 * }>} args
 */
export default function init({ props }) {
    onMount(() => {
        props.isWidget = true;
    });

    return props;
}
