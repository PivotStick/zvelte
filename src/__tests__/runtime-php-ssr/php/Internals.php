<?php

namespace Zvelte\Core;

use Countable;
use Traversable;

class Internals
{
    public static function attr(string $name, mixed $value, bool $is_boolean = false): string
    {
        if ($value == null || (!$value && $is_boolean) || ($value === '' && $name === 'class')) return '';

        $assignment = $is_boolean ? '' : '="' . self::escape_html($value, true) . '"';

        return sprintf(' %s%s', $name, $assignment);
    }


    public static function escape_html(mixed $value, bool $is_attr = false): string
    {
        $str = strval($value ?? '');
        return htmlspecialchars($str, $is_attr ? ENT_QUOTES : ENT_NOQUOTES);
    }

    public static function in(mixed $left, mixed $right): bool
    {
        return is_array($right) ? in_array($left, $right) : property_exists($right, $left);
    }

    public static function filter(object $props, string $name, ...$args): mixed
    {
        if (property_exists($props, $name)) {
            return ($props->$name)(...$args);
        }

        return Filters::$name(...$args);
    }

    public static function ensure_array_like($array_like_or_iterator)
    {
        return self::toArray($array_like_or_iterator, false);
    }

    /**
     * @internal
     */
    public static function toArray($seq, $preserveKeys = true)
    {
        if ($seq instanceof Traversable) {
            return iterator_to_array($seq, $preserveKeys);
        }

        if (!is_array($seq)) {
            return $seq;
        }

        return $preserveKeys ? $seq : array_values($seq);
    }

    /**
     * Checks if a variable is empty.
     *
     *    {# evaluates to true if the foo variable is null, false, or the empty string #}
     *    {% if foo is empty %}
     *        {# ... #}
     *    {% endif %}
     *
     * @param mixed $value A variable
     *
     * @internal
     */
    public static function testEmpty($value): bool
    {
        if ($value instanceof Countable) {
            return 0 === count($value);
        }

        if ($value instanceof Traversable) {
            return !iterator_count($value);
        }

        if (is_object($value) && method_exists($value, '__toString')) {
            return '' === (string) $value;
        }

        return '' === $value || false === $value || null === $value || [] === $value;
    }
}
