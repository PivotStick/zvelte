import { b, p, x } from "code-red";
import { mapChildren } from "../shared/mapChildren.js";
import { Text } from "./Text.js";
import Wrapper from "../shared/Wrapper.js";
import { attributeValueToJS } from "../shared/attributeValueToJS.js";

export class Element extends Wrapper {
    /**
     * @param {import("../Renderer.js").default} renderer
     * @param {import("../Block.js").default} block
     * @param {Wrapper} parent
     * @param {*} node
     */
    constructor(renderer, block, parent, node) {
        super(renderer, block, parent, node);
        this.renderer = renderer;
        this.name = node.name;

        const zoneAttributes = node.attributes.filter((a) =>
            a.name.startsWith("zone-"),
        );

        const zoneName = zoneAttributes.find((a) => a.name === "zone-name");
        const zonePath = zoneAttributes.find((a) => a.name === "zone-path");

        if (zoneName && zonePath) {
            this.zone = {
                name: "",
                path: "",
                props: [],
            };

            zoneAttributes.forEach((a) => {
                node.attributes.splice(node.attributes.indexOf(a), 1);
                const dataKey = "zone-data-";
                if (a.name.startsWith(dataKey)) {
                    const key = a.name.slice(dataKey.length);

                    this.zone.props.push({
                        key,
                        value: attributeValueToJS(a.value),
                    });
                }
            });

            zonePath.value.forEach((v) => {
                if (v.type !== "Text")
                    throw new Error(`zone-path cannot be dynamic (yet)`);
                this.zone.path += v.data;
            });

            zoneName.value.forEach((v) => {
                if (v.type !== "Text")
                    throw new Error(`zone-name cannot be dynamic (yet)`);
                this.zone.name += v.data;
            });

            const fileName = this.zone.path.match(/\/([^./]+)\..*$/)?.[1];

            if (fileName) {
                this.zone.identifier = x`${fileName}`;
                renderer.addImport(this.zone.identifier, this.zone.path);
            }
        }

        this.attributes = mapChildren(renderer, block, this, node.attributes);
        this.children = mapChildren(renderer, block, this, node.children);
    }

    /**
     * @param {import("../Block.js").default} block
     * @param {import("estree").Identifier=} parentNode
     * @param {import("estree").Identifier=} parentNodes
     */
    render(block, parentNode, parentNodes) {
        const id = block.getUniqueName(this.name);
        const hydratable = this.renderer.options.hydratable;
        const nodes = hydratable
            ? block.getUniqueName(`${this.name}_nodes`)
            : null;

        block.addElement(id, x`@element("${this.name}")`, parentNode);

        if (hydratable) {
            block.chunks.claim.push(
                x`${id} = @claimElement(${parentNodes}, "${this.node.name.toUpperCase()}", {})`,
            );
        }

        if (this.zone && this.zone.identifier) {
            const zoneId = block.getUniqueName(this.zone.name);
            let init = x`{
                ${
                    this.zone.props?.length
                        ? p`props: {
                            ${this.zone.props.map(
                                (prop) => p`${prop.key}: ${prop.value}`,
                            )}
                        }`
                        : null
                }
            }`;
            block.addVariable(zoneId, x`new ${this.zone.identifier}(${init})`);
            block.chunks.create.push(
                x`@createComponent(${zoneId}.$$.fragment)`,
            );
            block.chunks.mount.push(x`@mountComponent(${zoneId}, ${id}, null)`);
            block.chunks.update.push(x`${zoneId}.$set(${init}.props)`);
            block.chunks.destroy.push(x`@destroyComponent(${zoneId})`);

            if (hydratable) {
                block.chunks.claim.push(b`var ${nodes} = @children(${id})`);
                block.chunks.claim.push(
                    x`@claimComponent(${zoneId}.$$.fragment, ${nodes})`,
                );
            }
        } else {
            if (hydratable && this.children.length > 0) {
                block.chunks.claim.push(b`var ${nodes} = @children(${id})`);
            }
            if (
                this.children.length === 1 &&
                this.children[0] instanceof Text
            ) {
                block.chunks.create.push(
                    x`${id}.textContent = "${this.children[0].node.data}"`,
                );
            } else {
                for (let i = 0; i < this.children.length; i++) {
                    const child = this.children[i];
                    child.render(block, id, nodes);
                }

                if (hydratable && this.children.length > 0) {
                    block.chunks.claim.push(x`${nodes}.forEach(@detach)`);
                }
            }
        }

        for (let i = 0; i < this.attributes.length; i++) {
            const attr = this.attributes[i];
            attr.render(block, id, this.node);
        }
    }
}
