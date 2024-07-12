import type { CompilerOptions } from "../../compiler/types.js";

export type State = {
    scope: Record<string, any>[];
    els: any;
    bindingGroups: Record<string, any[]>;
    currentNode: Node;
    options: CompilerOptions;
};

export type ComponentInitArgs<
    T,
    Els extends Record<string, HTMLElement | Record<string, any>> = Record<
        string,
        HTMLElement
    >,
> = {
    /**
     * Your component's props
     *
     * Everything in here is reactive, even if you define a new property it
     * will become reactive.
     *
     * It is the best way to communicate interactivity with this component's parent
     */
    props: T;
    /**
     * Every `bind:this` will output in this object after the component is mounted
     *
     * **example**:
     * ```twig
     * <div bind:this={{ myDiv }}>foo</div>
     * ```
     *
     * will be accessible like this:
     *
     * ```javascript
     * export default function init({ els }) {
     *      onMount(() => {
     *          console.log("my element -->", els.myDiv);
     *      });
     * }
     * ```
     *
     * it also works on your components!
     *
     * *./Widget.zvelte*
     * ```twig
     * {% import Datatable from "./Datatable.zvelte" %}
     *
     * <button on:click={{ refresh }}>Refresh!</button>
     *
     * <Datatable bind:this={{ table }} />
     * ```
     *
     * *./Widget.js*
     * ```javascript
     * export default function init({ els, scope }) {
     *      scope.refresh = () => {
     *          els.table.refresh();
     *      };
     * }
     * ```
     */
    els: Els;

    /**
     * This acts exactly like `props` but without any reactivity.
     * and it is also only available in this component's instance
     * which makes everything in there private.
     *
     * Note that `props` will take precedence over what is in `scope`, so if you have
     * "foo" inside `props` and also in `scope` and you use it in your template
     * it will find it in `props` first.
     *
     * It is mostly used for event listeners
     */
    scope: Record<string, any>;
};

export type ComponentInitAsyncArgs<
    T,
    Els extends Record<string, HTMLElement | Record<string, any>> = Record<
        string,
        HTMLElement
    >,
> = ComponentInitArgs<T, Els> & {
    /**
     * Looks like this component is defined as an `async` component!
     *
     * Which means that he receives data from an API *before* being rendered!
     *
     * This method lets you trigger that call again and automatically update
     * the key used in this component's `props` for receiving your datas
     *
     * @param payload if you don't set it, it will use the current payload used for the API call, setting it will update the current payload used for this call and all future refreshes if not updated
     * @param full it's optional, if you set it to `true`, instead of just updating your `props` it will completly rerender your component
     */
    refresh(payload?: any, full?: boolean): Promise<any>;
};
