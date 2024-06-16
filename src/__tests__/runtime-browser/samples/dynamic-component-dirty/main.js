/**
 * @param {import("@pivotass/zvelte").Args<{
 *  i: number;
 *  current_path?: string;
 *  fn(path: string): void;
 * }>} args
 */
export default function init({ scope, props }) {
    props.current_path ??= "foo";
    props.i = 0;

    scope.getComponent = (/** @type {string} */ path) => {
        props.fn(path);
        return null;
    };

    scope.onClick = () => {
        props.i = props.i + 1;
    };
}
