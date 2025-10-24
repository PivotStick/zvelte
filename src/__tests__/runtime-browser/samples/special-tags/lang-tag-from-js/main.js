/**
 * @param {import("../../../../../internal/client/types.d.ts").ComponentInitArgs<any>} args
 */
export default function init({ props, lang }) {
    props.value = lang("some_key");
}
