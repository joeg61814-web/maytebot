<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PalabraProhibida extends Model
{
    protected $table    = 'palabras_prohibidas';
    protected $fillable = ['palabra', 'idioma'];
    public $timestamps  = false;
}
