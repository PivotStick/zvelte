import { ScopeRoot, createScopes } from "../3-transform/render_dom/scope.js";

/**
 * @param {import("#ast").Root} root
 */
export function analyseComponent(root) {
    const scopeRoot = new ScopeRoot();

    const { scope, scopes } = createScopes(
        root.fragment,
        scopeRoot,
        false,
        null,
    );

    return {
        root: scopeRoot,
        template: {
            ast: root.fragment,
            scope,
            scopes,
        },
    };
}
