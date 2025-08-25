import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ScanLine, ArrowRight, Plus, Trash2, Send, History, X, LoaderCircle, Package, Warehouse, AlertTriangle, Camera } from 'lucide-react';

// --- Komponen Notifikasi ---
const Alert = ({ message, type, onDismiss }) => {
    if (!message) return null;
    const baseClasses = "p-4 rounded-lg mb-4 text-sm flex items-center justify-between";
    const typeClasses = {
        error: "bg-red-100 text-red-700",
        success: "bg-green-100 text-green-700",
    };
    return (
        <div className={`${baseClasses} ${typeClasses[type]}`}>
            <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <span>{message}</span>
            </div>
            <button onClick={onDismiss} className="ml-4">
                <X className="w-5 h-5" />
            </button>
        </div>
    );
};

// --- Komponen Modal Scanner Kamera ---
const BarcodeScanner = ({ onScanSuccess, onScanError, onClose }) => {
    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            'reader',
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                rememberLastUsedCamera: true,
            },
            false // verbose
        );

        const successCallback = (decodedText, decodedResult) => {
            scanner.clear();
            onScanSuccess(decodedText);
        };

        const errorCallback = (error) => {
            // console.warn(error); // Bisa diaktifkan untuk debugging
        };

        scanner.render(successCallback, errorCallback);

        // Cleanup function untuk menghentikan scanner saat komponen unmount
        return () => {
            scanner.clear().catch(error => {
                console.error("Gagal membersihkan scanner.", error);
            });
        };
    }, [onScanSuccess]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-4 relative">
                <h3 className="text-lg font-bold text-center mb-2">Arahkan ke Barcode HU</h3>
                <div id="reader" className="w-full"></div>
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full text-slate-600 hover:bg-slate-100"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};


// --- Komponen Utama Aplikasi ---
export default function Index() {
    // State
    const [slocs, setSlocs] = useState([]);
    const [sourceSloc, setSourceSloc] = useState('');
    const [destinationSloc, setDestinationSloc] = useState('');
    const [barcode, setBarcode] = useState('');
    const [scannedItem, setScannedItem] = useState(null);
    const [transferList, setTransferList] = useState([]);
    const [transferHistory, setTransferHistory] = useState([]);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [isScanning, setIsScanning] = useState(false); // State untuk scanner kamera

    const barcodeInputRef = useRef(null);

    // --- Efek untuk memuat data awal ---
    useEffect(() => {
        axios.get(route('api.slocs')).then(res => setSlocs(res.data)).catch(err => setError('Gagal memuat Sloc.'));
        fetchHistory();
    }, []);

    // --- Efek untuk mencari barcode setelah di-set ---
    useEffect(() => {
        if (barcode) {
            handleBarcodeScan();
        }
    }, [barcode]);

    const fetchHistory = () => {
        axios.get(route('api.transfer.history')).then(res => setTransferHistory(res.data)).catch(err => setError('Gagal memuat riwayat.'));
    };

    // --- Fungsi untuk mencari data HU ---
    const handleBarcodeScan = async () => {
        if (!barcode) return;

        setIsLoading(true);
        setError('');
        setScannedItem(null);

        try {
            const response = await axios.get(route('api.hu', { barcode }));
            setScannedItem(response.data);
        } catch (err) {
            setError(`Handling Unit "${barcode}" tidak ditemukan.`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Fungsi callback setelah scan kamera berhasil ---
    const handleScanSuccess = (decodedText) => {
        setIsScanning(false);
        setBarcode(decodedText); // Ini akan memicu useEffect di atas untuk mencari HU
    };

    // --- Fungsi untuk menambahkan HU ke daftar ---
    const handleAddItem = () => {
        if (!scannedItem) {
            setError('Pindai Handling Unit terlebih dahulu.');
            return;
        }

        const isExist = transferList.some(item => item.handling_unit === scannedItem.handling_unit);
        if (isExist) {
            setError(`HU ${scannedItem.handling_unit} sudah ada di daftar.`);
        } else {
            setTransferList([...transferList, { ...scannedItem, quantity: 1 }]);
        }
        setScannedItem(null);
        setBarcode('');
        barcodeInputRef.current?.focus();
    };

    // --- Fungsi untuk menghapus HU dari daftar ---
    const handleRemoveItem = (hu) => {
        setTransferList(transferList.filter(item => item.handling_unit !== hu));
    };

    // --- Fungsi untuk mem-posting transfer ---
    const handlePostTransfer = async () => {
        // ... (Fungsi ini tetap sama seperti sebelumnya)
        if (!canPost) {
            if (sourceSloc === destinationSloc) setError("Sloc asal dan tujuan tidak boleh sama.");
            else setError("Pastikan Sloc dan daftar HU sudah terisi dengan benar.");
            return;
        }
        setIsPosting(true);
        setError('');
        try {
            const payload = {
                source_sloc: sourceSloc,
                destination_sloc: destinationSloc,
                items: transferList.map(item => ({ handling_unit: item.handling_unit, description: item.description })),
            };
            const response = await axios.post(route('api.transfer.store'), payload);
            setSuccessMessage(`Transfer berhasil! Dokumen SAP: ${response.data.sap_document}`);
            setTransferList([]);
            setSourceSloc('');
            setDestinationSloc('');
            setScannedItem(null);
            fetchHistory();
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Terjadi kesalahan saat posting.";
            setError(errorMessage);
        } finally {
            setIsPosting(false);
        }
    };

    const canPost = sourceSloc && destinationSloc && sourceSloc !== destinationSloc && transferList.length > 0 && !isPosting;

    return (
        <div className="bg-slate-50 font-sans min-h-screen">
            {isScanning && <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}

            <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl">
                <header className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                    <div className="flex items-center space-x-3">
                        <Package className="w-8 h-8 text-indigo-600" />
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Stock Transfer (Handling Unit)</h1>
                    </div>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <History className="w-5 h-5" />
                        <span className="hidden sm:inline">Riwayat</span>
                    </button>
                </header>

                <main>
                    <Alert message={error} type="error" onDismiss={() => setError('')} />
                    <Alert message={successMessage} type="success" onDismiss={() => setSuccessMessage('')} />

                    {/* Bagian 1: Pemilihan Sloc */}
                    <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                        {/* ... (Kode Sloc tetap sama) */}
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">1. Tentukan Lokasi Transfer</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div>
                                <label htmlFor="sourceSloc" className="text-sm font-medium text-slate-600 mb-1 block">Dari Sloc</label>
                                <div className="relative">
                                    <Warehouse className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <select id="sourceSloc" value={sourceSloc} onChange={(e) => setSourceSloc(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                                        <option value="">Pilih Sloc Asal</option>
                                        {slocs.map(sloc => <option key={sloc.sloc_id} value={sloc.sloc_id}>{sloc.sloc_id} - {sloc.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="destinationSloc" className="text-sm font-medium text-slate-600 mb-1 block">Ke Sloc</label>
                                 <div className="relative">
                                    <Warehouse className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <select id="destinationSloc" value={destinationSloc} onChange={(e) => setDestinationSloc(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                                        <option value="">Pilih Sloc Tujuan</option>
                                        {slocs.map(sloc => <option key={sloc.sloc_id} value={sloc.sloc_id}>{sloc.sloc_id} - {sloc.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                         {sourceSloc && destinationSloc && sourceSloc === destinationSloc && ( <p className="text-xs text-red-500 mt-2">Sloc asal dan tujuan tidak boleh sama.</p> )}
                    </div>

                    {/* Bagian 2: Pindai Barang */}
                    <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">2. Pindai Barcode Handling Unit (HU)</h2>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-grow">
                                <ScanLine className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    ref={barcodeInputRef}
                                    type="text"
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleBarcodeScan()}
                                    placeholder="Masukkan atau pindai barcode HU..."
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                />
                            </div>
                            <button
                                onClick={() => setIsScanning(true)}
                                className="p-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
                                title="Pindai dengan Kamera"
                            >
                                <Camera className="w-5 h-5" />
                            </button>
                        </div>

                        {isLoading && <p className="text-center text-slate-500 mt-4">Mencari...</p>}

                        {scannedItem && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-slate-800">{scannedItem.description}</p>
                                    <p className="text-sm text-slate-500">HU: {scannedItem.handling_unit}</p>
                                </div>
                                <button onClick={handleAddItem} className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition">
                                    <Plus className="w-5 h-5" />
                                    <span>Tambah</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bagian 3: Daftar Transfer & Aksi */}
                    <div className="bg-white p-6 rounded-xl shadow-sm">
                        {/* ... (Kode daftar transfer dan tombol post tetap sama) */}
                         <h2 className="text-lg font-semibold text-slate-700 mb-4">3. Daftar HU untuk Ditransfer</h2>
                        <div className="space-y-3">
                            {transferList.length > 0 ? (
                                transferList.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                        <div>
                                            <p className="font-medium text-slate-800">{item.description}</p>
                                            <p className="text-xs text-slate-500">HU: {item.handling_unit}</p>
                                        </div>
                                        <button onClick={() => handleRemoveItem(item.handling_unit)} className="text-red-500 hover:text-red-700">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-slate-500 py-6">Belum ada Handling Unit yang ditambahkan.</p>
                            )}
                        </div>
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <button onClick={handlePostTransfer} disabled={!canPost} className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition disabled:bg-slate-300 disabled:cursor-not-allowed">
                                {isPosting ? ( <><LoaderCircle className="animate-spin w-5 h-5" /><span>Memproses...</span></> ) : ( <><Send className="w-5 h-5" /><span>Post Transfer ({transferList.length} HU)</span></> )}
                            </button>
                        </div>
                    </div>
                </main>

                {/* Modal Riwayat Transfer */}
                {showHistory && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
                        {/* ... (Kode modal riwayat tetap sama) */}
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                            <header className="flex justify-between items-center p-4 border-b">
                                <h3 className="text-xl font-bold text-slate-800">Riwayat Transfer</h3>
                                <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-slate-800"><X className="w-6 h-6" /></button>
                            </header>
                            <div className="p-6 overflow-y-auto">
                                {transferHistory.length > 0 ? (
                                    <div className="space-y-4">
                                        {transferHistory.map(t => (
                                            <div key={t.id} className="p-4 border rounded-lg">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 font-semibold text-slate-700">
                                                            <span>{t.source_sloc_id}</span>
                                                            <ArrowRight className="w-4 h-4 text-slate-400" />
                                                            <span>{t.destination_sloc_id}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500">{new Date(t.created_at).toLocaleString()} | Doc: {t.sap_document_number}</p>
                                                    </div>
                                                    <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">{t.items.length} HU</span>
                                                </div>
                                                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 mt-2">
                                                    {t.items.map((item, idx) => (<li key={idx}>{item.description} (<strong>{item.handling_unit}</strong>)</li>))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                ) : ( <p className="text-center text-slate-500 py-10">Tidak ada riwayat transfer.</p> )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
