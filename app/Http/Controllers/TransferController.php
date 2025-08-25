<?php

namespace App\Http\Controllers;

use App\Services\SAPService;
use App\Models\TransferHeader;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log; // Tambahkan Log untuk debugging

class TransferController extends Controller
{
    protected $sapService;

    public function __construct(SAPService $sapService)
    {
        $this->sapService = $sapService;
    }

    public function index()
    {
        return Inertia::render('Transfer/Index');
    }

    // BARU: Fungsi untuk menangani login ke SAP
    public function loginSap(Request $request)
    {
        $credentials = $request->validate([
            'sap_user' => 'required|string',
            'sap_password' => 'required|string',
        ]);

        try {
            // Panggil fungsi login di SAPService Anda
            // Fungsi ini harus mengembalikan true jika berhasil, atau melempar Exception jika gagal.
            $loginSuccess = $this->sapService->login($credentials['sap_user'], $credentials['sap_password']);

            if ($loginSuccess) {
                // Simpan status login di session
                $request->session()->put('sap_logged_in', true);
                $request->session()->put('sap_user', $credentials['sap_user']); // Simpan username jika perlu

                return response()->json(['message' => 'SAP login successful!'], 200);
            } else {
                 return response()->json(['message' => 'Invalid SAP credentials.'], 401);
            }

        } catch (\Exception $e) {
            Log::error('SAP Login Failed: ' . $e->getMessage());
            return response()->json(['message' => 'SAP login failed: ' . $e->getMessage()], 500);
        }
    }

    // BARU: Fungsi untuk logout dari SAP session
    public function logoutSap(Request $request)
    {
        // Hapus status login dari session
        $request->session()->forget('sap_logged_in');
        $request->session()->forget('sap_user');

        // Anda mungkin juga perlu memanggil fungsi logout di SAPService jika koneksi perlu ditutup secara eksplisit
        // $this->sapService->logout();

        return response()->json(['message' => 'SAP logout successful!'], 200);
    }


    public function getSlocs()
    {
        return response()->json($this->sapService->getStorageLocations());
    }

    // API untuk mengambil data HU
    public function getHandlingUnit(string $barcode)
    {
        // DIUBAH: Tambahkan pengecekan session SAP
        if (!session('sap_logged_in')) {
            return response()->json(['message' => 'Unauthorized. Please login to SAP first.'], 401);
        }

        try {
            $hu = $this->sapService->getHandlingUnitByBarcode($barcode);
            if ($hu) {
                return response()->json($hu);
            }
            return response()->json(['message' => 'Handling Unit not found'], 404);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error fetching HU: ' . $e->getMessage()], 500);
        }
    }

    // API untuk menyimpan transfer
    public function storeTransfer(Request $request)
    {
        // DIUBAH: Tambahkan pengecekan session SAP
        if (!session('sap_logged_in')) {
            return response()->json(['message' => 'Unauthorized. Please login to SAP first.'], 401);
        }

        $validated = $request->validate([
            'source_sloc' => 'required|string',
            'destination_sloc' => 'required|string|different:source_sloc',
            'items' => 'required|array|min:1',
            'items.*.handling_unit' => 'required|string',
            'items.*.description' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            // 1. Posting ke SAP menggunakan RFC ZRFC_HU_GOODS_MOVEMENT
            // Pastikan SAPService Anda menggunakan koneksi yang sudah diautentikasi
            $sapResponse = $this->sapService->postStockTransfer($validated);

            // Cek apakah ada error dari SAP
            if (isset($sapResponse['error'])) {
                 DB::rollBack();
                 return response()->json(['message' => 'SAP Error: ' . $sapResponse['error']], 400);
            }

            // 2. Simpan ke database lokal jika SAP sukses
            $header = TransferHeader::create([
                'source_sloc_id' => $validated['source_sloc'],
                'destination_sloc_id' => $validated['destination_sloc'],
                'user_id' => Auth::id(),
                'sap_document_number' => $sapResponse['sap_document_number'],
            ]);

            foreach ($validated['items'] as $item) {
                $header->items()->create([
                    'handling_unit' => $item['handling_unit'],
                    'description' => $item['description'],
                    'quantity' => 1, // Setiap item adalah 1 HU
                ]);
            }

            DB::commit();
            return response()->json([
                'message' => 'Transfer posted successfully!',
                'sap_document' => $sapResponse['sap_document_number']
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Store Transfer Failed: ' . $e->getMessage());
            return response()->json(['message' => 'An error occurred: ' . $e->getMessage()], 500);
        }
    }

    public function getHistory()
    {
        $history = TransferHeader::with('items')
            ->latest()
            ->take(50)
            ->get();
        return response()->json($history);
    }
}
