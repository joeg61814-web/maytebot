<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemoriaChat extends Model
{
    protected $table    = 'memorias_chat';
    protected $fillable = ['owner_key', 'contenido'];
}
