<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use Illuminate\Support\Facades\Route;

// ── Auth ─────────────────────────────────────────────────────
Route::post('/register',       [AuthController::class, 'register']);
Route::post('/login',          [AuthController::class, 'login']);
Route::post('/logout',         [AuthController::class, 'logout']);

// ── Chat ─────────────────────────────────────────────────────
Route::post('/chat',           [ChatController::class, 'chat']);
Route::get('/init-profile',    [ChatController::class, 'initProfile']);
Route::get('/splash-media',    [ChatController::class, 'splashMedia']);
Route::get('/memories',        [ChatController::class, 'getMemories']);
Route::post('/learn-memories', [ChatController::class, 'learnMemories']);
