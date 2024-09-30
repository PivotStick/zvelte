import type { Fragment, ZvelteNode, Css } from "#ast";
import type { CompilerOptions } from "../../types.js";
import { Scope, ScopeRoot } from "../3-transform/render_dom/scope.js";

export interface ComponentAnalysis extends Analysis {
    root: ScopeRoot;

    css: null | {
        hash: string;
        ast: Css.StyleSheet;
        keyframes: string[];
        generated?: { code: string };
    };

    elements: Array<RegularElement | SvelteElement>;

    template: {
        ast: Fragment;
        scope: Scope;
        scopes: Map<ZvelteNode, Scope>;
    };

    source: string;

    needs_props: boolean;

    /** Identifiers that make up the `bind:group` expression -> internal group binding name */
    bindingGroups: Map<
        [key: string, bindings: Array<Binding | null>],
        Identifier
    >;
}
