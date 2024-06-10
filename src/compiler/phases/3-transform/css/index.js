import MagicString from "magic-string";
import { walk } from "zimmerframe";
import {
    is_keyframes_node,
    regex_css_name_boundary,
    remove_css_prefix,
} from "../../css.js";
import { analyseComponent } from "../../2-analyze/index.js";

/**
 * @typedef {{
 *   code: MagicString;
 *   source: string;
 *   hash: string;
 *   selector: string;
 * }} State
 */

/**
 *
 * @param {string} source
 * @param {ReturnType<typeof analyseComponent>} analysis
 * @param {{
 *  dev: boolean;
 *  filename: string;
 *  cssOutputFilename?: string;
 * }} options
 */
export function renderStylesheet(source, analysis, options) {
    const code = new MagicString(source);

    /** @type {State} */
    const state = {
        source,
        code,
        hash: analysis.css.hash,
        selector: `.${analysis.css.hash}`,
    };

    // @ts-ignore
    walk(
        /** @type {import('css-tree').CssNode} */ (analysis.css.ast),
        state,
        visitors
    );

    const css = {
        code: code.toString(),
        map: code.generateMap({
            // include source content; makes it easier/more robust looking up the source map code
            includeContent: true,
            // generateMap takes care of calculating source relative to file
            source: options.filename,
            file: options.cssOutputFilename || options.filename,
        }),
    };

    return css;
}

/** @type {import('zimmerframe').Visitors<import('css-tree').CssNode, State>} */
const visitors = {
    _: (node, context) => {
        if (node.loc) {
            const loc = locToIndex(context.state.code.toString(), node.loc);
            context.state.code.addSourcemapLocation(loc.start);
            context.state.code.addSourcemapLocation(loc.end);
        }

        context.next();
    },

    SelectorList(node, { state, path }) {
        console.log(node);
    },
};

/**
 * @param {string} source
 * @param {import("css-tree").CssLocation} loc
 */
function locToIndex(source, loc) {
    return {
        start: lineColToIndex(source, loc.start.line, loc.start.column),
        end: lineColToIndex(source, loc.end.line, loc.end.column),
    };
}

/**
 * @param {string} source
 * @param {number} line
 * @param {number} column
 */
function lineColToIndex(source, line, column) {
    let index = 0;
    const lines = source.split("\n");
    for (let i = 0; i < line; i++) {
        if (i === line - 1) {
            index += column - 1;
        } else {
            index += lines[i].length;
        }
    }

    return index;
}
