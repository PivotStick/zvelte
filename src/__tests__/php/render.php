<?php

error_reporting(E_ERROR | E_PARSE);

spl_autoload_register(function ($class) {
    $class = str_replace('\\', '/', $class);

    if (str_starts_with($class, 'Zvelte/Core')) {
        $class = str_replace('Zvelte/Core', './', $class);
    } else if (str_starts_with($class, 'Zvelte/Components/')) {
        $class = str_replace('Zvelte/Components/', './components/', $class);
    }

    return include $class . '.php';
});

$payload = (object)[
    'out' => '',
    'head' => (object)[
        'out' => '',
        'title' => '',
    ],
];

$class = $argv[1];
$props = isset($argv[2]) ? json_decode(base64_decode($argv[2])) : (object)[];

$class::render($payload, $props);

echo json_encode($payload);
