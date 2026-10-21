// components/submit/ModuleUploadTabs.tsx
// ─── Tab lampiran berkas: lokal / Google Drive / kamera ───────────────────────
//
// Seluruh state unggahan (berkas lokal, stream kamera, snapshot, berkas Drive)
// hidup di sini. Induk hanya melihat satu hal: `contentUrl` — URL yang sudah
// jadi. Setiap perubahan di sini melapor lewat `onContentUrlChange`, dan
// setelah submit berhasil induk cukup mengganti `key` komponen ini untuk
// memasang ulang seluruh tab dengan state bersih (tidak ada API imperatif
// "bersihkan dirimu" yang bisa terlupakan).
//
// Yang **tidak** pernah meninggalkan komponen ini: data URL snapshot kamera.
// Snapshot adalah pratinjau lokal; baru `usePhoto` mengirimnya sebagai berkas
// nyata ke `/api/uploads` dan menukarnya dengan URL.
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload, Link as LinkIcon, Camera, Check, Trash2, Loader2,
  FileText, CheckCircle2, AlertCircle, HardDrive, RefreshCw, FolderOpen,
} from "lucide-react";
import {
  ACCEPTED_MODULE_FILE_TYPES, MAX_MODULE_FILE_BYTES, uploadFile,
} from "@/lib/uploadClient";
import { DrivePickerModal } from "./DrivePickerModal";
import type { MockDriveFile } from "./types";

interface ModuleUploadTabsProps {
  /** URL lampiran saat ini (react-hook-form `contentUrl`). */
  contentUrl: string;
  /** Dipanggil setiap kali URL lampiran berubah (termasuk dikosongkan). */
  onContentUrlChange: (url: string) => void;
}

export function ModuleUploadTabs({
  contentUrl, onContentUrlChange,
}: ModuleUploadTabsProps) {
  const [activeUploadTab, setActiveUploadTab] = useState<"local" | "drive" | "camera">("local");

  // Local Upload State
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStateText, setUploadStateText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  // Google Drive State
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [selectedDriveFile, setSelectedDriveFile] = useState<MockDriveFile | null>(null);
  const [directDriveUrl, setDirectDriveUrl] = useState("");

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isShutterFlash, setIsShutterFlash] = useState(false);
  // The uploaded URL for a camera snapshot. The data URL in `capturedImage` is
  // only ever a local preview and is never sent to the server.
  const [attachedPhotoUrl, setAttachedPhotoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photoAttached = attachedPhotoUrl !== null && contentUrl === attachedPhotoUrl;

  // Clean up camera stream on unmount or tab change
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // --- Local Storage Upload Logic ---
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void startLocalFileUpload(files[0]);
    }
  };

  const startLocalFileUpload = async (file: File) => {
    setFileError(null);

    if (file.size > MAX_MODULE_FILE_BYTES) {
      setFileError(
        `Ukuran berkas melebihi batas ${Math.round(MAX_MODULE_FILE_BYTES / 1024 / 1024)}MB! ` +
        `(Berkas Anda: ${(file.size / 1024 / 1024).toFixed(2)}MB). ` +
        `Untuk berkas lebih besar, unggah ke Google Drive terlebih dahulu lalu tempel tautannya di tab Google Drive.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLocalFile(file);
    setIsUploading(true);
    setUploadProgress(15);
    setUploadStateText("Mengunggah berkas...");

    // This used to read the file into a base64 data URL and store that in
    // Postgres. The bytes now go to object storage and only the URL is kept.
    const outcome = await uploadFile(file, "module");

    if (!outcome.ok || !outcome.url) {
      setFileError(outcome.error ?? "Gagal mengunggah berkas. Silakan coba lagi.");
      setUploadProgress(0);
      setUploadStateText("");
      setIsUploading(false);
      setLocalFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadProgress(100);
    setUploadStateText("Berkas berhasil diunggah!");
    setIsUploading(false);
    onContentUrlChange(outcome.url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      void startLocalFileUpload(files[0]);
    }
  };

  const clearLocalFile = () => {
    setLocalFile(null);
    setUploadProgress(0);
    setUploadStateText("");
    onContentUrlChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // --- Google Drive Logic ---
  const handleSelectDriveFile = (file: MockDriveFile) => {
    setSelectedDriveFile(file);
    onContentUrlChange(file.link);
    setIsDrivePickerOpen(false);
  };

  const clearDriveFile = () => {
    setSelectedDriveFile(null);
    onContentUrlChange("");
  };

  const handleDirectDriveUrlChange = (url: string) => {
    setDirectDriveUrl(url);
    if (url.trim().startsWith("https://") && (url.includes("drive.google.com") || url.includes("docs.google.com"))) {
      onContentUrlChange(url);
    } else if (url.trim() === "") {
      onContentUrlChange("");
    }
  };

  // --- Camera Logic ---
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Izin kamera ditolak. Silakan aktifkan akses kamera pada peramban Anda.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      setIsShutterFlash(true);
      setTimeout(() => setIsShutterFlash(false), 150);

      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Draw the current video frame into canvas
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        // Local preview only. It is uploaded in `usePhoto`, so a snapshot the
        // student discards never leaves the browser.
        const dataUrl = canvas.toDataURL("image/png");
        setCapturedImage(dataUrl);
        setAttachedPhotoUrl(null);
        stopCamera();
      }
    }
  };

  const usePhoto = async () => {
    if (!capturedImage) return;

    setFileError(null);
    setIsUploading(true);
    setUploadProgress(30);
    setUploadStateText("Mengunggah foto...");

    // The snapshot used to be embedded in the module row as a base64 data URL.
    // Turn it back into a real file and store the bytes instead.
    const blob = await (await fetch(capturedImage)).blob();
    const file = new File([blob], `kamera-${Date.now()}.png`, { type: "image/png" });
    const outcome = await uploadFile(file, "module");

    if (!outcome.ok || !outcome.url) {
      setFileError(outcome.error ?? "Gagal mengunggah foto. Silakan coba lagi.");
      setUploadProgress(0);
      setUploadStateText("");
      setIsUploading(false);
      return;
    }

    setAttachedPhotoUrl(outcome.url);
    setUploadProgress(100);
    setUploadStateText("Foto terpasang!");
    setIsUploading(false);
    onContentUrlChange(outcome.url);
  };

  return (
    <>
      {isDrivePickerOpen && (
        <DrivePickerModal
          onSelect={handleSelectDriveFile}
          onClose={() => setIsDrivePickerOpen(false)}
        />
      )}

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Tab headers */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-1.5 gap-1.5">
          {[
            { id: "local", label: "Penyimpanan Lokal", icon: HardDrive },
            { id: "drive", label: "Google Drive", icon: FolderOpen },
            { id: "camera", label: "Ambil Foto Kamera", icon: Camera }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveUploadTab(tab.id as "local" | "drive" | "camera");
                // Clear streams when switching tabs
                if (tab.id !== "camera") stopCamera();
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeUploadTab === tab.id
                  ? "bg-white dark:bg-zinc-800 text-nawa-primary dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
              }`}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-5 bg-white dark:bg-zinc-900 text-center">
          {/* 1. Penyimpanan Lokal */}
          {activeUploadTab === "local" && (
            <div className="space-y-4">
              {!localFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-nawa-primary bg-zinc-50 dark:bg-zinc-950/40 rounded-xl py-8 px-4 cursor-pointer flex flex-col items-center justify-center group transition-all duration-300 relative overflow-hidden"
                >
                  {/* Interactive upload icon */}
                  <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    Pilih file atau seret file Anda di sini
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Mendukung dokumen .pdf dan gambar .png, .jpg, .webp (maks. 10MB)
                  </p>

                  <input
                    type="file"
                    id="module-file-input"
                    aria-label="Pilih file modul untuk diunggah"
                    ref={fileInputRef}
                    onChange={handleLocalFileChange}
                    accept={ACCEPTED_MODULE_FILE_TYPES}
                    className="sr-only"
                  />
                </div>
              ) : (
                <div className="text-left border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60 shadow-sm relative overflow-hidden">
                  {isUploading && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className="h-full bg-nawa-primary transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-nawa-primary dark:text-indigo-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{localFile.name}</p>
                      {isUploading ? (
                        <p className="text-xs text-nawa-primary dark:text-indigo-400 mt-0.5 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {uploadProgress}% - {uploadStateText}</p>
                      ) : (
                        <p className="text-[10px] text-zinc-500 mt-0.5">{(localFile.size / 1024 / 1024).toFixed(2)} MB • Berhasil diunggah</p>
                      )}
                    </div>
                  </div>

                  {!isUploading && (
                    <button
                      type="button"
                      onClick={clearLocalFile}
                      aria-label="Hapus file yang sudah diunggah"
                      className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  )}
                </div>
              )}

              {fileError && (
                <div className="p-3 border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 rounded-xl flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 text-left mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>
          )}

          {/* 2. Google Drive */}
          {activeUploadTab === "drive" && (
            <div className="space-y-4">
              {!selectedDriveFile ? (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setIsDrivePickerOpen(true)}
                    className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all hover:scale-[1.01] shadow-md border border-zinc-200 dark:border-zinc-800 mb-4"
                  >
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none">
                      <path d="M19.3496 14.6508L14.6508 19.3496L19.3496 14.6508Z" fill="currentColor"/>
                      <path d="M8.8296 2.45L15.17 2.45L22.35 14.88L16 14.88L8.8296 2.45Z" fill="#FFC107"/>
                      <path d="M1.6496 15.15L8.8296 2.45L16 14.88L8.82 27.3L1.6496 15.15Z" fill="#00E676"/>
                      <path d="M16 14.88L23.17 27.3L8.82 27.3L16 14.88Z" fill="#29B6F6"/>
                    </svg>
                    Buka Google Drive Picker
                  </button>

                  <div className="w-full flex items-center gap-3 my-2 text-zinc-400">
                    <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Atau Paste Link Manual</span>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
                  </div>

                  <div className="w-full relative mt-2 text-left">
                    <label htmlFor="module-drive-url" className="block text-[11px] font-bold text-zinc-400 mb-1">Link Berbagi Google Drive</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <input
                        type="url"
                        id="module-drive-url"
                        value={directDriveUrl}
                        onChange={(e) => handleDirectDriveUrlChange(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400"
                        placeholder="https://drive.google.com/file/d/..."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-left border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      {/* Drive icon indicator */}
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <path d="M8.8296 2.45L15.17 2.45L22.35 14.88L16 14.88L8.8296 2.45Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[200px] sm:max-w-xs">{selectedDriveFile.name}</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1 font-semibold"><Check className="h-3 w-3" /> Drive File Terkoneksi ({selectedDriveFile.size})</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={clearDriveFile}
                    aria-label="Hapus tautan Google Drive"
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Ambil Foto Kamera */}
          {activeUploadTab === "camera" && (
            <div className="flex flex-col items-center">
              {cameraError && (
                <div className="mb-4 p-3 border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 rounded-xl flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 text-left">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {!isCameraActive && !capturedImage ? (
                <div className="py-6 flex flex-col items-center">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="bg-nawa-primary hover:bg-indigo-500 text-white px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all hover:scale-[1.01] shadow-md border border-indigo-500"
                  >
                    <Camera className="h-4.5 w-4.5" />
                    Aktifkan Kamera Live
                  </button>
                  <p className="text-xs text-zinc-500 mt-3 max-w-sm">
                    Ambil gambar catatan fisik Anda secara langsung menggunakan kamera laptop atau ponsel.
                  </p>
                </div>
              ) : isCameraActive ? (
                <div className="w-full max-w-md border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-black relative aspect-[4/3] flex items-center justify-center shadow-lg group">
                  {/* Camera Stream Viewfinder */}
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    className="w-full h-full object-cover scale-x-[-1]"
                  />

                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 border border-white/10 pointer-events-none">
                    <div className="border-r border-b border-white/5" />
                    <div className="border-r border-b border-white/5" />
                    <div className="border-b border-white/5" />
                    <div className="border-r border-b border-white/5" />
                    <div className="border-r border-b border-white/5" />
                    <div className="border-b border-white/5" />
                  </div>

                  <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[9px] px-2 py-0.5 rounded-full font-bold tracking-widest flex items-center gap-1 animate-pulse">
                    <span className="h-1.5 w-1.5 bg-white rounded-full" /> LIVE
                  </div>

                  {isShutterFlash && (
                    <div className="absolute inset-0 bg-white z-40 transition-opacity duration-150" />
                  )}

                  <div className="absolute inset-x-0 bottom-4 flex justify-center items-center gap-4 px-4 z-10 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-800 text-white p-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                    >
                      Batal
                    </button>

                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="h-14 w-14 rounded-full border-4 border-white bg-red-600 flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-black/20 group/btn active:scale-95"
                      aria-label="Ambil Foto"
                    >
                      <span className="h-10 w-10 bg-white rounded-full group-hover/btn:bg-zinc-100 transition-colors" />
                    </button>

                    <div className="w-10" />
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex flex-col p-3 shadow-md">
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-black border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capturedImage!}
                      alt="Captured snapshot"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-nawa-success text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                      PREVIEW
                    </div>
                  </div>

                  <div className="flex gap-3 mt-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Ambil Ulang
                    </button>

                    <button
                      type="button"
                      onClick={usePhoto}
                      disabled={isUploading}
                      className={`flex-1 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-md disabled:opacity-60 disabled:cursor-wait ${
                        photoAttached
                          ? "bg-emerald-600 hover:bg-nawa-success shadow-nawa-success/10 border border-emerald-600"
                          : "bg-nawa-primary hover:bg-indigo-500 shadow-indigo-500/10 border border-nawa-primary"
                      }`}
                    >
                      {photoAttached ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Terpasang
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" /> Gunakan Foto
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {contentUrl && (
          <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-nawa-success" />
              <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">File berhasil dilampirkan</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[150px] sm:max-w-xs">{contentUrl}</span>
          </div>
        )}
      </div>
    </>
  );
}
