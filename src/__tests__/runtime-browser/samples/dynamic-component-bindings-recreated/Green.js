/**
 * @param {import("@pivotass/zvelte").Args<{ foo: string }>} args
 */
export default function init({ props }) {
    props.foo ??= "green";
}
