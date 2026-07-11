<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Conversacion extends Model
{
    protected $table      = 'conversaciones';
    protected $fillable   = ['usuario_id', 'rol', 'contenido'];
    public    $timestamps = true;
    const     UPDATED_AT  = null;
}
