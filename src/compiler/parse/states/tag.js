import { is_void } from '../../shared/utils/names.js';
import { readExpression } from '../read/expression.js';
import * as csstree from 'css-tree';

const validTagName = /^\!?[a-zA-Z]{1,}:?[a-zA-Z0-9\-]*/;
const regexWhitespaceOrSlashOrClosingTag = /(\s|\/|>)/;
const regexTokenEndingCharacter = /[\s=\/>"']/;

/**
 * @param {import("../index.js").Parser} parser
 */
export const tag = (parser) => {
	const start = parser.index;
	parser.index++;

	// Ignore comments
	if (parser.eat('!--')) {
		parser.readUntil(/-->/);
		parser.eat('-->', true);
		return;
	}

	const isClosingTag = parser.eat('/');
	const name = readTagName(parser);

	const element = {
		start,
		end: null,
		type: 'Element',
		name,
		attributes: [],
		children: [],
	};
	parser.allowWhitespace();

	if (isClosingTag) {
		parser.eat('>', true);
		let parent = parser.current();

		while (parent.name !== name) {
			if (parent.type !== 'Element') {
				throw parser.error(`"${name}" has no opening tag`);
			}
			parent.end = start;
			parser.stack.pop();
			parent = parser.current();
		}

		parent.end = start;
		parser.stack.pop();
		return;
	}

	let attribute;
	let uniqueNames = new Set();
	while ((attribute = readAttribute(parser, uniqueNames))) {
		element.attributes.push(attribute);
		parser.allowWhitespace();
	}

	const selfClosing = parser.eat('/') || is_void(name);

	parser.eat('>', true);

	if (element.name === 'style') {
		if (parser.css)
			throw parser.error(
				'Only one style tag can be declared in a component',
			);

		let code = '';
		let start = parser.index;
		let end = start;

		if (!selfClosing) {
			code = parser.readUntil(/<\/style>/);
			end = parser.index;
			parser.eat('</style>', true);
		}

		parser.css = {
			start,
			end,
			code,
			ast: csstree.toPlainObject(
				csstree.parse(code, {
					offset: start,
				}),
			),
		};
	} else {
		parser.current().children.push(element);

		if (selfClosing) {
			element.end = parser.index;
		} else {
			parser.stack.push(element);
		}
	}
};

/**
 * @param {import("../index.js").Parser} parser
 */
const readTagName = (parser) => {
	const name = parser.readUntil(regexWhitespaceOrSlashOrClosingTag);

	if (!validTagName.test(name)) {
		throw parser.error(`Invalid tag name "${name}"`);
	}

	return name;
};

/**
 * @param {import("../index.js").Parser} parser
 * @param {Set<string>} uniqueNames
 */
const readAttribute = (parser, uniqueNames) => {
	const start = parser.index;

	/**
	 * @param {string} name
	 */
	const checkUnique = (name) => {
		if (uniqueNames.has(name)) {
			throw parser.error(`Duplicate attribute "${name}"`);
		}
		uniqueNames.add(name);
	};

	const name = parser.readUntil(regexTokenEndingCharacter);
	if (!name) return null;
	let end = parser.index;
	const [, trueName = name, modifier = null] =
		/(.*):([^:]+)$/.exec(name) ?? [];

	parser.allowWhitespace();

	/**
	 * @type {any[] | boolean}
	 */
	let value = true;

	if (parser.eat('=')) {
		parser.allowWhitespace();
		value = readAttributeValue(parser);
		end = parser.index;
	}

	checkUnique(trueName === 'on' ? name : trueName);

	return {
		start,
		end,
		type: 'Attribute',
		name: trueName,
		modifier,
		value,
	};
};

/**
 * @param {import("../index.js").Parser} parser
 */
const readAttributeValue = (parser) => {
	const quoteMark = parser.eat("'") ? "'" : parser.eat('"') ? '"' : null;

	if (!quoteMark)
		throw parser.error(`Expected quote mark after attribute name`);

	let value = [];

	while (!parser.match(quoteMark)) {
		if (parser.eat('{{')) {
			const expression = readExpression(parser.readUntil(/}}/), parser);
			parser.eat('}}', true);
			value.push(expression);
		} else {
			let text = value[value.length - 1];

			if (text?.type !== 'Text') {
				text = {
					start: parser.index,
					end: parser.index,
					type: 'Text',
					data: '',
				};
				value.push(text);
			}

			text.data += parser.template[parser.index++];
			text.end = parser.index;
		}
	}

	parser.eat(quoteMark, true);

	return value;
};
