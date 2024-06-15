import { slide } from "@pivotass/zvelte/transition";

export const scope = () => ({
    slide,
});

/**
 * @param {import("@pivotass/zvelte").Args<{
 *  open: boolean;
 *  color: string;
 *  border: boolean;
 * }>} args
 */
export default function init({ props }) {
    props.open ??= false;
    props.color ??= "red";
    props.border ??= false;
}
