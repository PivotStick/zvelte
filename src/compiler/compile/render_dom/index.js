import Renderer from "./Renderer.js";

/**
 * @type {import('../../../../types/index.js').CompilerRenderer}
 */
export function renderDom(ast, options, meta) {
    const renderer = new Renderer(ast, options, meta);
    return renderer.render();
}
