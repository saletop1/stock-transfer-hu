<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\TransferController;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/transfer', [TransferController::class, 'index'])->name('transfer.index');

    // API Endpoints
    Route::get('/api/storage-locations', [TransferController::class, 'getSlocs'])->name('api.slocs');
    Route::get('/api/handling-unit/{barcode}', [TransferController::class, 'getHandlingUnit'])->name('api.hu');
    Route::post('/api/transfer', [TransferController::class, 'storeTransfer'])->name('api.transfer.store');
    Route::get('/api/transfer-history', [TransferController::class, 'getHistory'])->name('api.transfer.history');
    Route::post('/sap/login', [TransferController::class, 'loginSap'])->name('sap.login');
    Route::post('/sap/logout', [TransferController::class, 'logoutSap'])->name('sap.logout');
    Route::get('/transfer/hu/{barcode}', [TransferController::class, 'getHandlingUnit']);
    Route::post('/transfer/store', [TransferController::class, 'storeTransfer']);
});
