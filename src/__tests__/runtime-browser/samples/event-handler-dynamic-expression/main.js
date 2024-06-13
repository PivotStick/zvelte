/**
 * @param {import("@pivotass/zvelte").Args<{ name: string; }>} args
 */
export default function init({ props, scope }) {
    props.name = "bar";

    scope.foo = () => {
        props.name = "foo";
    };

    scope.bar = () => {
        props.name = "bar";
    };
}
