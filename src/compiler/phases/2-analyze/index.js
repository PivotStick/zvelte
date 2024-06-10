import { hash } from "../../utils/hash.js";
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
        null
    );

    const analysis = {
        root: scopeRoot,
        css: root.css
            ? {
                  hash: "zvelte-" + hash(root.css.code),
                  ast: root.css.ast,
                  code: root.css.code,
              }
            : null,
        template: {
            ast: root.fragment,
            scope,
            scopes,
        },
    };

    return analysis;
}
