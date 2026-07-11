<?php

use Illuminate\Support\Facades\Route;

// Ruta raíz — sirve el frontend del chat
Route::get('/{any?}', function () {
    return view('chat');
})->where('any', '.*');
