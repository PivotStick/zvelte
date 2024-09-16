<?php

namespace Zvelte\Components;

class Component 
{
	public static function render(object $payload, object $props): void
	{
		$payload->out .= 'Hello World!';
	}

	public static function getAllComponents(?object $props = null): array
	{
		$props ??= (object)[];
		return [];
	}
}