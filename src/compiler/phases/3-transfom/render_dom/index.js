import { print } from "esrap";
import * as b from "./builders.js";
import { isVoid } from "../../../shared/utils/names.js";

const $$anchor = b.identifier("$$anchor");
const $$props = b.identifier("$$props");

/**
 * @type {import("../types.js").Transformer}
 */
export function renderDom(ast, options, meta) {
    const fn = b.fn(options.filename.replace(/\..*$/, ""));

    fn.params.push($$anchor, $$props);

    /** @type {import("estree").VariableDeclaration[]} */
    const rootTemplates = [];
    /** @type {import("estree").TemplateElement[]} */
    const templateStack = [];
    /** @type {import("estree").BlockStatement[]} */
    const blockStack = [];

    renderBlock(fn.body, ast, {
        get block() {
            return blockStack[blockStack.length - 1];
        },
        append(expression) {
            this.block.body.push(b.expressionStatement(expression));
        },
        template: {
            push(block) {
                let suffix = "";
                if (rootTemplates.length) {
                    suffix = `_${rootTemplates.length}`;
                }

                const templateLiteral = b.templateLiteral();
                const rootTemplate = b.rootTemplate(
                    `root${suffix}`,
                    templateLiteral,
                    true,
                );
                const template = b.templateElement();

                templateLiteral.quasis.push(template);

                blockStack.push(block);
                rootTemplates.push(rootTemplate);
                templateStack.push(template);
            },

            pop() {
                blockStack.pop();
                rootTemplates.pop();
                templateStack.pop();
            },

            append(text) {
                const current = templateStack[templateStack.length - 1];
                current.value.raw += text;
            },
        },
    });

    return print({
        type: "Program",
        sourceType: "module",
        body: [
            {
                type: "ImportDeclaration",
                source: {
                    type: "Literal",
                    value: "@pivotass/zvelte/internal/client",
                },
                specifiers: [
                    {
                        type: "ImportNamespaceSpecifier",
                        local: b.identifier("$"),
                    },
                ],
            },
            ...rootTemplates,
            {
                type: "ExportDefaultDeclaration",
                declaration: fn,
            },
        ],
    });
}

/**
 * @typedef {{
 *   readonly block: import("estree").BlockStatement;
 *   append(expression: import("estree").Expression): void;
 *   template: {
 *      push(block: import("estree").BlockStatement): void;
 *      append(text: string): void;
 *      pop(): void;
 *   }
 * }} Ctx
 */

/**
 * @param {import("estree").BlockStatement} block
 * @param {Exclude<import("#ast").Any, import("#ast").Expression>} node
 * @param {Ctx} ctx
 */
function renderBlock(block, node, ctx) {
    ctx.template.push(block);
    ctx.append(b.internal("push", [b.literal(true)]));
    handle(node, ctx);
    ctx.append(b.internal("pop"));
}

/**
 * @param {Exclude<import("#ast").Any, import("#ast").Expression>} node
 * @param {Ctx} ctx
 */
function handle(node, ctx) {
    switch (node.type) {
        case "Root":
            handle(node.fragment, ctx);
            break;

        case "Fragment":
            node.nodes.forEach((fragment) => handle(fragment, ctx));
            break;

        case "Text":
            ctx.template.append(node.data);
            break;

        case "Element":
            ctx.template.append(`<${node.name}`);
            if (isVoid(node.name)) {
                ctx.template.append(`/>`);
            } else {
                ctx.template.append(`>`);
                handle(node.fragment, ctx);
                ctx.template.append(`</${node.name}>`);
            }
            break;

        default:
            throw new Error(`"${node.type}" not handled in js render`);
    }
}

/**
 * @param {import("#ast").Expression} node
 */
function expression(node) {
    switch (node.type) {
        default:
            throw new Error(
                `"${node.type}" expression not handled in js render`,
            );
    }
}
