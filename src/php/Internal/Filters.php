<?php

namespace Zvelte\Internal;

use Error;

/**
 * @internal
 */
function internal_to_array($seq, $preserveKeys = true)
{
    if ($seq instanceof \Traversable) {
        return iterator_to_array($seq, $preserveKeys);
    }

    if (!\is_array($seq)) {
        return $seq;
    }

    return $preserveKeys ? $seq : array_values($seq);
}

class Filters
{
    public static function run($filterName, ...$args)
    {
        // code...
    }

    /**
     * Returns a trimmed string.
     *
     * @param string|null $string
     * @param string|null $characterMask
     * @param string      $side
     *
     * @return string
     *
     * @throws Error When an invalid trimming side is used (not a string or not 'left', 'right', or 'both')
     */
    public static function filter($string, $characterMask = null, $side = 'both')
    {
        if (null === $characterMask) {
            $characterMask = " \t\n\r\0\x0B";
        }

        switch ($side) {
            case 'both':
                return trim($string ?? '', $characterMask);
            case 'left':
                return ltrim($string ?? '', $characterMask);
            case 'right':
                return rtrim($string ?? '', $characterMask);
            default:
                throw new Error('Trimming side must be "left", "right" or "both".');
        }
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
     * @return string The concatenated string
     */
    public static function join($value, $glue = '', $and = null)
    {
        if (!is_iterable($value)) {
            $value = (array) $value;
        }

        $value = internal_to_array($value, false);

        if (0 === \count($value)) {
            return '';
        }

        if (null === $and || $and === $glue) {
            return implode($glue, $value);
        }

        if (1 === \count($value)) {
            return $value[0];
        }

        return implode($glue, \array_slice($value, 0, -1)) . $and . $value[\count($value) - 1];
    }
}
