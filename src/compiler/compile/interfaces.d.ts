interface BaseNode {
	type: string;
	children?: TemplateNode[];
	[propName: string]: any;
}

export interface Fragment extends BaseNode {
	type: 'Fragment';
	children: TemplateNode[];
}

export interface Text extends BaseNode {
	type: 'Text';
	children: undefined;
	data: string;
}

export interface MustacheTag extends BaseNode {
	type: 'MustacheTag';
	expression: any;
}

export interface Element extends BaseNode {
	type: 'Element';
	attributes: Array<Attribute>;
	name: string;
}

export interface Attribute extends BaseNode {
	type: 'Attribute';
	name: string;
	value: any[];
}

export type TemplateNode = Text | MustacheTag | BaseNode | Element | Attribute;
