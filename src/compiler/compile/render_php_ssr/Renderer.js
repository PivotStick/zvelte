import * as cr from "code-red";
import { b, print } from "./php_printer/index.js";
import PhPParser from "php-parser";
import Fragment from "./wrappers/Fragment.js";
import Block from "./Block.js";
import { walk } from "./php_printer/utils/walker/index.js";

export default class Renderer {
    // @ts-ignore
    parser = new PhPParser({});

    /**
     * @type {Block[]}
     */
    blocks = [];

    /**
     * @type {import("php-parser").UseGroup[]}
     */
    imports = [];

    /**
     * @type {string[]}
     */
    internals = [];

    /**
     * @type {string[]}
     */
    ctxVars = [];

    /**
     * @param {*} ast
     * @param {import('../../../../types/index.js').CompilerOptions} options
     * @param {*} meta
     */
    constructor(ast, options, meta) {
        const fragmentBlock = new Block({
            name: "render",
            public: true,
        });

        this.blocks.push(fragmentBlock);
        this.fragment = new Fragment(this, fragmentBlock, null, ast.html);
        this.fragment.render(fragmentBlock);
    }

    render() {
        const nodes = this.blocks.flatMap((block) => {
            return block.render();
        });

        walk(
            // @ts-ignore
            { kind: "program", body: nodes },
            {
                /**
                 * @param {any} node
                 */
                enter: (node) => {
                    if (node.kind === "name" && node.name.startsWith("@")) {
                        node.name = node.name.slice(1);
                        if (!this.internals.includes(node.name)) {
                            this.internals.push(node.name);
                        }
                    } else if (
                        node.kind === "propertylookup" &&
                        node.offset.kind === "identifier" &&
                        this.ctxVars.includes(node.offset.name) &&
                        node.what.kind === "propertylookup" &&
                        node.what.offset.kind === "identifier" &&
                        node.what.offset.name === "props"
                    ) {
                        node.what.offset.name = "vars";
                    }
                },
            },
        );

        if (this.internals.length) {
            this.imports.push({
                kind: "usegroup",
                name: "Zvelte\\Internal",
                // @ts-ignore
                items: this.internals.map((name) => ({
                    kind: "useitem",
                    name,
                    alias: null,
                    type: null,
                })),
            });
        }

        const php = b`

        ${this.imports};

        namespace Zvelte\\Components;

        error_reporting(0); 

        class Component {
            $${nodes};
        }`;

        const body = cr.b`
        import { execSync } from 'child_process';

        const #text = \`${print(php)
            .code.replace(/\\/g, "\\\\")
            .replace(/\$\{/g, "\\${")}\`

        export default class Component {
            render(props) {
                let php = "";

                php += #text.slice(5).trim();
                php += \`echo Component::render(json_decode('\${JSON.stringify(props).replace(/'/g, "\\'")}'));\`;

                php = php.replace(/"/g, '\\\\"').replace(/\\$/g, "\\\\$");

                try {
                    const html = execSync(\`php -r "\${php}"\`);
                    return {
                        html: html.toString(),
                        error: null,
                    }
                } catch (error) {
                    return {
                        html: null,
                        error: error.stderr.toString(),
                    }
                }
            }
        }
        `;

        // @ts-ignore
        return cr.print({ type: "Program", body });
    }

    /**
     * @param {string} name
     */
    uniqueName(name) {
        let count = 0;

        while (this.blocks.find((block) => block.name.name === name)) {
            name = name + ++count;
        }

        return name;
    }

    extractImports() {}
}
