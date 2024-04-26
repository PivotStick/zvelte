// https://github.com/darkskyapp/string-hash/blob/master/index.js
import { walk } from 'estree-walker';
import * as csstree from 'css-tree';

const regex_return_characters = /\r/g;

/**
 * @param {string} str
 * @returns {string}
 */
export default function hash(str) {
	str = str.replace(regex_return_characters, '');
	let hash = 5381;
	let i = str.length;

	while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
	return (hash >>> 0).toString(36);
}

export class Stylesheet {
	/**
	 * @param {*} ast
	 */
	constructor(ast) {
		this.id = `zone-${hash(ast.css.code)}`;
		this.ast = ast.css.ast;

		walk(ast.html, {
			enter: (node) => {
				if (node.type === 'Element') {
					const classAttr = node.attributes.find(
						(attr) => attr.name === 'class',
					);

					if (classAttr) {
						classAttr.value.push({
							type: 'Text',
							data: ` ${this.id}`,
						});
					} else {
						node.attributes.push({
							type: 'Attribute',
							name: 'class',
							modifier: null,
							value: [{ type: 'Text', data: this.id }],
						});
					}
				}
			},
		});
	}

	render() {
		const classSelector = {
			type: 'ClassSelector',
			name: this.id,
		};

		walk(this.ast, {
			enter(node) {
				if (node.type === 'Selector') {
					const children = [];
					for (const child of node.children) {
						children.push(child);
						if (
							child.type === 'TypeSelector' ||
							child.type === 'ClassSelector'
						) {
							children.push(classSelector);
						}
					}
					node.children = children;
				}
			},
		});

		return csstree.generate(this.ast);
	}
}
