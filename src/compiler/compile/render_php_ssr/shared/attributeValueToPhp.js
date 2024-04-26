import { expressionToPhp } from '../../../parse/utils/expressionToPhp.js';
import { x } from '../php_printer/index.js';

/**
 * @param {any[]} values
 */
export function attributeValueToPhp(values) {
	let dynamic = !!values.find((t) => t.type !== 'Text');

	if (dynamic) {
		if (values.length === 1) {
			return expressionToPhp(values[0]);
		}

		let node;

		/**
		 * @param {any} expression
		 */
		const push = (expression) => {
			if (!node) {
				node = expression;
			} else {
				node = {
					kind: 'bin',
					type: '.',
					left: node,
					right: expression,
				};
			}
		};

		values.forEach((node) => {
			if (node.type === 'Text') {
				push({
					kind: 'string',
					value: node.data,
					raw: `'${node.data}'`,
					isDoubleQuote: false,
				});
			} else {
				push(expressionToPhp(node));
			}
		});

		return node;
	} else {
		return x`"${values.map((a) => a.data).join('')}"`;
	}
}
