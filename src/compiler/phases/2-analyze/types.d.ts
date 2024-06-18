import type { CssNodePlain } from "css-tree";
import type { Fragment, ZvelteNode } from "#ast";
import { Scope, ScopeRoot } from "../3-transform/render_dom/scope.js";

export interface ComponentAnalysis extends Analysis {
    root: ScopeRoot;

    css: null | {
        hash: string;
        ast: CssNodePlain;
        code: string;
    };

    template: {
        ast: Fragment;
        scope: Scope;
        scopes: Map<ZvelteNode, Scope>;
    };

    /** Identifiers that make up the `bind:group` expression -> internal group binding name */
    bindingGroups: Map<
        [key: string, bindings: Array<Binding | null>],
        Identifier
    >;
}
