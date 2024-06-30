<?php

namespace Zvelte\Components;

use Zvelte\Core\{Internals};

class Component 
{
	public static function render(object $props): string
	{
		return implode('', [
			Internals::escape_html($props->foo),
			'
',
			Internals::escape_html($props->bar),
		]);
	}

	public static function getAllComponents(?object $props = null): array
	{
		$props ??= (object)[];
		return [];
	}
}