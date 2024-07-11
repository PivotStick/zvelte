<?php

error_reporting(E_ERROR | E_PARSE);

require("./Filters.php");
require("./Internals.php");
require("./current.php");

$payload = (object)[
    'out' => '',
    'head' => '',
    'title' => ''
];

\Zvelte\Components\Component::render($payload, json_decode(base64_decode($argv[1])));

echo $payload->out;
