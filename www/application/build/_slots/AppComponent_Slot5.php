<?php

function RenderAppComponent_Slot5(
    AppComponent $component,
    PageEngine $pageEngine,
    array $slots
    , ...$scope
) {
    $slotContents = [];
    ?><?=htmlentities($component->content)?><?php   
}