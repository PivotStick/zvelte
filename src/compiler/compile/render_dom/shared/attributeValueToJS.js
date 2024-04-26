import { x } from 'code-red';
import { expressionToJS } from '../../../parse/utils/expressionToJS.js';

/**
 * @param {any[]} values
 */
export function attributeValueToJS(values) {
	let dynamic = !!values.find((t) => t.type !== 'Text');

	if (dynamic) {
		if (values.length === 1) {
			return expressionToJS(values[0]);
		}
		const templateLiteral = {
			type: 'TemplateLiteral',
			expressions: [],
			quasis: [],
		};
		values.forEach((node, i, arr) => {
			const tail = i === arr.length - 1;
			if (node.type === 'Text') {
				templateLiteral.quasis.push({
					type: 'TemplateElement',
					value: {
						raw: node.data,
						cooked: node.data,
					},
					tail,
				});
			} else {
				templateLiteral.expressions.push(expressionToJS(node));
				if (tail) {
					templateLiteral.quasis.push({
						type: 'TemplateElement',
						tail: true,
						value: { raw: '', cooked: '' },
					});
				}
			}
		});

		return templateLiteral;
	} else {
		return x`"${values.map((a) => a.data).join('')}"`;
	}
}
