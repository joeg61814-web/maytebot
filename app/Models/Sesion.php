<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sesion extends Model
{
    protected $table    = 'sesiones';
    protected $fillable = ['usuario_id', 'token', 'expiry'];
}
