<?php

error_reporting(E_ERROR | E_PARSE);

require("./Filters.php");
require("./Internals.php");
require("./current.php");

echo (\Zvelte\Components\Component::render(json_decode(base64_decode($argv[1]))));
