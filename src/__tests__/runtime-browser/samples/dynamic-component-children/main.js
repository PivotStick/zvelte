/**
 * @param {import("@pivotass/zvelte").Args<{
 *  x: boolean;
 *  tag: string;
 *  things: string[];
 * }>} args
 */
export default function init({ props }) {
    props.tag ??= "you're it";
    props.things ??= ["a", "b", "c"];
}
