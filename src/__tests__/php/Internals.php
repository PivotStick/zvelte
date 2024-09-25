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
        $str = is_scalar($value)
            ? (is_bool($value)
                ? ($value ? 'true' : 'false')
                : strval($value))
            : '';

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

    public static function component(string $className, object $payload, object $props)
    {
        $className = str_replace('/', '\\', $className);
        $className::render($payload, $props);
    }

    public static function spread_props(...$objects)
    {
        $out = [];

        foreach ($objects as $o) {
            $out = [...$out, ...(array)$o];
        }

        return (object)$out;
    }

    public static function head(object $payload, callable $render): void
    {
        $fakePayload = (object)['title' => '', 'out' => ''];

        $render($fakePayload);

        $payload->head->out .= '<!--[-->';
        $payload->head->out .= $fakePayload->out;
        $payload->head->out .= '<!--]-->';
        if (!empty($fakePayload->title)) {
            $payload->head->title = sprintf('<title>%s</title>', $fakePayload->title);
        }
    }
}
