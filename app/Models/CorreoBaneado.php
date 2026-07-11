<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CorreoBaneado extends Model
{
    protected $table    = 'correos_baneados';
    protected $fillable = ['email', 'motivo'];
}
