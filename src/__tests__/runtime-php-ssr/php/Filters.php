<?php

namespace Zvelte\Core;

use CallbackFilterIterator;
use Countable;
use Error;
use Iterator;
use IteratorAggregate;
use IteratorIterator;
use LimitIterator;
use OutOfBoundsException;
use SimpleXMLElement;
use Traversable;

class Filters
{
    public static function abs(int|float $num): int|float
    {
        return abs($num);
    }

    /**
     * Batches item.
     *
     * @param array $items An array of items
     * @param int   $size  The size of the batch
     * @param mixed $fill  A value used to fill missing items
     *
     * @internal
     */
    public static function batch($items, $size, $fill = null, $preserveKeys = true): array
    {
        if (!is_iterable($items)) {
            throw new Error(sprintf('The "batch" filter expects a sequence/mapping or "Traversable", got "%s".', is_object($items) ? get_class($items) : gettype($items)));
        }

        $size = ceil($size);

        $result = array_chunk(Internals::toArray($items, $preserveKeys), $size, $preserveKeys);

        if (null !== $fill && $result) {
            $last = count($result) - 1;
            if ($fillCount = $size - count($result[$last])) {
                for ($i = 0; $i < $fillCount; ++$i) {
                    $result[$last][] = $fill;
                }
            }
        }

        return $result;
    }

    /**
     * Returns a capitalized string.
     *
     * @param string|null $string A string
     *
     * @internal
     */
    public static function capitalize(string $charset, $string): string
    {
        return mb_strtoupper(mb_substr($string ?? '', 0, 1, $charset), $charset) . mb_strtolower(mb_substr($string ?? '', 1, null, $charset), $charset);
    }

    /**
     * Returns the values from a single column in the input array.
     *
     * <pre>
     *  {% set items = [{ 'fruit' : 'apple'}, {'fruit' : 'orange' }] %}
     *
     *  {% set fruits = items|column('fruit') %}
     *
     *  {# fruits now contains ['apple', 'orange'] #}
     * </pre>
     *
     * @param array|Traversable $array An array
     * @param int|string         $name  The column name
     * @param int|string|null    $index The column to use as the index/keys for the returned array
     *
     * @return array The array of values
     *
     * @internal
     */
    public static function column($array, $name, $index = null): array
    {
        if ($array instanceof Traversable) {
            $array = iterator_to_array($array);
        } elseif (!is_array($array)) {
            throw new Error(sprintf('The column filter only works with sequences/mappings or "Traversable", got "%s" as first argument.', gettype($array)));
        }

        return array_column($array, $name, $index);
    }

    // The '_default' filter is used internally to avoid using the ternary operator
    // which costs a lot for big contexts (before PHP 5.4). So, on average,
    // a function call is cheaper.
    /**
     * @internal
     */
    public static function default($value, $default = '')
    {
        if (Internals::testEmpty($value)) {
            return $default;
        }

        return $value;
    }

    /**
     * @internal
     */
    public static function filter($array, callable $arrow)
    {
        if (!is_iterable($array)) {
            throw new Error(sprintf('The "filter" filter expects a sequence/mapping or "Traversable", got "%s".', is_object($array) ? get_class($array) : gettype($array)));
        }

        if (is_array($array)) {
            return array_filter($array, $arrow, ARRAY_FILTER_USE_BOTH);
        }

        // the IteratorIterator wrapping is needed as some internal PHP classes are Traversable but do not implement Iterator
        return new CallbackFilterIterator(new IteratorIterator($array), $arrow);
    }

    /**
     * Returns the first element of the item.
     *
     * @param mixed $item A variable
     *
     * @return mixed The first element of the item
     *
     * @internal
     */
    public static function first(string $charset, $item)
    {
        $elements = self::slice($charset, $item, 0, 1, false);

        return is_string($elements) ? $elements : current($elements);
    }

    public static function format(string $format, array ...$args): string
    {
        return sprintf($format, ...$args);
    }

    /**
     * Joins the values to a string.
     *
     * The separators between elements are empty strings per default, you can define them with the optional parameters.
     *
     *  {{ [1, 2, 3]|join(', ', ' and ') }}
     *  {# returns 1, 2 and 3 #}
     *
     *  {{ [1, 2, 3]|join('|') }}
     *  {# returns 1|2|3 #}
     *
     *  {{ [1, 2, 3]|join }}
     *  {# returns 123 #}
     *
     * @param array       $value An array
     * @param string      $glue  The separator
     * @param string|null $and   The separator for the last pair
     *
     * @internal
     */
    public static function join($value, $glue = '', $and = null): string
    {
        if (!is_iterable($value)) {
            $value = (array) $value;
        }

        $value = Internals::toArray($value, false);

        if (0 === count($value)) {
            return '';
        }

        if (null === $and || $and === $glue) {
            return implode($glue, $value);
        }

        if (1 === count($value)) {
            return $value[0];
        }

        return implode($glue, array_slice($value, 0, -1)) . $and . $value[count($value) - 1];
    }

    public static function json_encode(...$args): string|false
    {
        return json_encode(...$args);
    }

    /**
     * Returns the keys for the given array.
     *
     * It is useful when you want to iterate over the keys of an array:
     *
     *  {% for key in array|keys %}
     *      {# ... #}
     *  {% endfor %}
     *
     * @internal
     */
    public static function keys($array): array
    {
        if ($array instanceof Traversable) {
            while ($array instanceof IteratorAggregate) {
                $array = $array->getIterator();
            }

            $keys = [];
            if ($array instanceof Iterator) {
                $array->rewind();
                while ($array->valid()) {
                    $keys[] = $array->key();
                    $array->next();
                }

                return $keys;
            }

            foreach ($array as $key => $item) {
                $keys[] = $key;
            }

            return $keys;
        }

        if (!is_array($array)) {
            return [];
        }

        return array_keys($array);
    }

    /**
     * Returns the last element of the item.
     *
     * @param mixed $item A variable
     *
     * @return mixed The last element of the item
     *
     * @internal
     */
    public static function last(string $charset, $item)
    {
        $elements = self::slice($charset, $item, -1, 1, false);

        return is_string($elements) ? $elements : current($elements);
    }

    /**
     * Returns the length of a variable.
     *
     * @param mixed $thing A variable
     *
     * @internal
     */
    public static function length(string $charset, $thing): int
    {
        if (null === $thing) {
            return 0;
        }

        if (is_scalar($thing)) {
            return mb_strlen($thing, $charset);
        }

        if ($thing instanceof Countable || is_array($thing) || $thing instanceof SimpleXMLElement) {
            return count($thing);
        }

        if ($thing instanceof Traversable) {
            return iterator_count($thing);
        }

        if (method_exists($thing, '__toString')) {
            return mb_strlen((string) $thing, $charset);
        }

        return 1;
    }

    /**
     * Converts a string to lowercase.
     *
     * @param string|null $string A string
     *
     * @internal
     */
    public static function lower(string $charset, $string): string
    {
        return mb_strtolower($string ?? '', $charset);
    }

    /**
     * @internal
     */
    public static function map($array, $arrow)
    {
        $r = [];
        foreach ($array as $k => $v) {
            $r[$k] = $arrow($v, $k);
        }

        return $r;
    }

    /**
     * Merges any number of arrays or Traversable objects.
     *
     *  {% set items = { 'apple': 'fruit', 'orange': 'fruit' } %}
     *
     *  {% set items = items|merge({ 'peugeot': 'car' }, { 'banana': 'fruit' }) %}
     *
     *  {# items now contains { 'apple': 'fruit', 'orange': 'fruit', 'peugeot': 'car', 'banana': 'fruit' } #}
     *
     * @param array|Traversable ...$arrays Any number of arrays or Traversable objects to merge
     *
     * @internal
     */
    public static function merge(...$arrays): array
    {
        $result = [];

        foreach ($arrays as $argNumber => $array) {
            if (!is_iterable($array)) {
                throw new Error(sprintf('The merge filter only works with sequences/mappings or "Traversable", got "%s" for argument %d.', gettype($array), $argNumber + 1));
            }

            $result = array_merge($result, Internals::toArray($array));
        }

        return $result;
    }

    /**
     * Inserts HTML line breaks before all newlines in a string.
     *
     * @param string|null $string
     *
     * @internal
     */
    public static function nl2br($string): string
    {
        return nl2br($string ?? '');
    }

    /**
     * Slices a variable.
     *
     * @param mixed $item         A variable
     * @param int   $start        Start of the slice
     * @param int   $length       Size of the slice
     * @param bool  $preserveKeys Whether to preserve key or not (when the input is an array)
     *
     * @return mixed The sliced variable
     *
     * @internal
     */
    public static function slice(string $charset, $item, $start, $length = null, $preserveKeys = false)
    {
        if ($item instanceof Traversable) {
            while ($item instanceof IteratorAggregate) {
                $item = $item->getIterator();
            }

            if ($start >= 0 && $length >= 0 && $item instanceof Iterator) {
                try {
                    return iterator_to_array(new LimitIterator($item, $start, $length ?? -1), $preserveKeys);
                } catch (OutOfBoundsException $e) {
                    return [];
                }
            }

            $item = iterator_to_array($item, $preserveKeys);
        }

        if (is_array($item)) {
            return array_slice($item, $start, $length, $preserveKeys);
        }

        return mb_substr((string) $item, $start, $length, $charset);
    }
    public static function split()
    {
    }
    public static function trim()
    {
    }
    public static function upper()
    {
    }
    public static function constant()
    {
    }
}
