<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MayteFoto extends Model
{
    protected $table    = 'mayte_fotos';
    protected $fillable = ['ruta', 'semana_activa'];
}
