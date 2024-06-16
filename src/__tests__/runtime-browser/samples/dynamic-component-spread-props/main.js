import { effect } from "../../../../internal/client/index.js";

/**
 * @param {import('@pivotass/zvelte').Args<{
 *  Comp1: any;
 *  Comp2: any;
 *  view: any;
 *  props: any;
 * }>} args
 */
export default function init({ props, scope }) {
    props.view ??= props.Comp1;

    effect(() => {
        props.props = props.view === props.Comp1 ? { value: 1 } : { value: 2 };
    });

    scope.bar = "bar";
    scope.cb = function () {};

    scope.setView = (/** @type {any} */ view) => {
        props.view = view;
    };
}
