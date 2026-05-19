// app/(dashboard)/submit/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Upload, 
  Link as LinkIcon, 
  Camera, 
  Check, 
  Trash2, 
  Loader2, 
  Sparkles, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  HardDrive,
  FileUp,
  X,
  Search,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  HelpCircle,
  Image as ImageIcon
} from "lucide-react";

// Standard subjects for SMAN 2 Jonggol
const SUBJECTS = [
  "Matematika", "Fisika", "Kimia", "Biologi", 
  "Sejarah", "Geografi", "Ekonomi", "Sosiologi", 
  "Bahasa Indonesia", "Bahasa Inggris", "Informatika"
];

const moduleSchema = z.object({
  title: z.string().min(5, "Judul minimal harus 5 karakter"),
  subject: z.string().min(2, "Mata pelajaran wajib dipilih atau diisi"),
  grade: z.string().min(1, "Kelas wajib dipilih"),
  category: z.string().min(2, "Kategori wajib dipilih"),
  contentUrl: z.string().refine(
    (val) => val.startsWith("data:") || /^https?:\/\/.+/.test(val),
    { message: "Wajib menyertakan URL file/dokumen yang valid atau unggah berkas terlebih dahulu" }
  ),
});

type FormData = z.infer<typeof moduleSchema>;

interface MockDriveFile {
  name: string;
  size: string;
  type: "PDF" | "DOCX" | "PPTX";
  link: string;
}

const MOCK_DRIVE_FILES: MockDriveFile[] = [
  { name: "Ringkasan_Fisika_Kuantum_Lengkap_XI.pdf", size: "4.2 MB", type: "PDF", link: "https://drive.google.com/file/d/1A2B3C-fisika-kuantum/view" },
  { name: "Soal_Latihan_UTBK_Matematika_2026.docx", size: "1.8 MB", type: "DOCX", link: "https://drive.google.com/file/d/1X9Y8Z-utbk-matematika/view" },
  { name: "Catatan_Biologi_Sel_dan_Genetika_X.pdf", size: "6.5 MB", type: "PDF", link: "https://drive.google.com/file/d/1M5N6O-biologi-sel/view" },
  { name: "Slide_Presentasi_Sejarah_Kemerdekaan_XII.pptx", size: "12.4 MB", type: "PPTX", link: "https://drive.google.com/file/d/1P2Q3R-sejarah/view" },
  { name: "Bank_Soal_Kimia_Unsur_Materi_Reguler.pdf", size: "3.1 MB", type: "PDF", link: "https://drive.google.com/file/d/1K7L8M-kimia-unsur/view" }
];

export default function SubmitModulePage() {
  const [submitType, setSubmitType] = useState<"module" | "question">("module");
  
  // Custom Question Form State
  const [questionText, setQuestionText] = useState("");
  const [questionSubject, setQuestionSubject] = useState("");
  const [questionCategory, setQuestionCategory] = useState("UTBK");
  const [questionDifficulty, setQuestionDifficulty] = useState<"mudah" | "sedang" | "sulit">("sedang");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [optionE, setOptionE] = useState("");
  const [questionAnswerKey, setQuestionAnswerKey] = useState("A");
  const [isQuestionSubmitting, setIsQuestionSubmitting] = useState(false);
  const [showQuestionSuccess, setShowQuestionSuccess] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeUploadTab, setActiveUploadTab] = useState<"local" | "drive" | "camera">("local");
  
  // Real-time approved modules count from database
  const [totalActiveModules, setTotalActiveModules] = useState<number | null>(null);

  // Local Upload State
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStateText, setUploadStateText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  
  // Google Drive State
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [driveSearch, setDriveSearch] = useState("");
  const [selectedDriveFile, setSelectedDriveFile] = useState<MockDriveFile | null>(null);
  const [directDriveUrl, setDirectDriveUrl] = useState("");

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isShutterFlash, setIsShutterFlash] = useState(false);

  // Load active modules count from database
  useEffect(() => {
    const fetchActiveCount = async () => {
      try {
        const res = await fetch("/api/modules/count");
        if (res.ok) {
          const data = await res.json();
          setTotalActiveModules(data.count);
        }
      } catch (err) {
        console.error("Gagal memuat jumlah modul aktif:", err);
      }
    };
    fetchActiveCount();
  }, []);
  
  // Celebration Success State
  const [showCelebration, setShowCelebration] = useState(false);
  const [submittedModuleName, setSubmittedModuleName] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue, trigger, watch } = useForm<FormData>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      title: "",
      subject: "",
      grade: "Umum",
      category: "",
      contentUrl: "",
    }
  });

  const selectedSubject = watch("subject");
  const selectedGrade = watch("grade");
  const selectedCategory = watch("category");
  const currentContentUrl = watch("contentUrl");

  // Clean up camera stream on unmount or tab change
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const handleSubjectSelect = (subj: string) => {
    setValue("subject", subj);
    trigger("subject");
  };

  const handleGradeSelect = (grd: string) => {
    setValue("grade", grd);
    trigger("grade");
  };

  const handleCategorySelect = (cat: string) => {
    setValue("category", cat);
    trigger("category");
  };

  // --- Local Storage Upload Logic ---
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      startLocalFileUpload(files[0]);
    }
  };

  const startLocalFileUpload = (file: File) => {
    setFileError(null);
    const maxSizeBytes = 1 * 1024 * 1024; // 1MB — data URL disimpan langsung di DB
    if (file.size > maxSizeBytes) {
      setFileError(
        `Ukuran file melebihi batas 1MB! (Berkas Anda: ${(file.size / 1024 / 1024).toFixed(2)}MB). ` +
        `Untuk file lebih besar, unggah ke Google Drive terlebih dahulu lalu paste link-nya di tab Google Drive.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLocalFile(file);
    setIsUploading(true);
    setUploadProgress(10);
    setUploadStateText("Membaca berkas...");

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 80) + 10;
        setUploadProgress(Math.min(90, pct));
      }
    };

    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadProgress(100);
      setUploadStateText("Berkas berhasil dimuat!");
      setIsUploading(false);
      setValue("contentUrl", dataUrl);
      trigger("contentUrl");
    };

    reader.onerror = () => {
      setFileError("Gagal membaca berkas. Silakan coba lagi.");
      setIsUploading(false);
      setLocalFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Animate initial steps while FileReader runs
    setTimeout(() => { setUploadProgress(40); setUploadStateText("Memproses berkas..."); }, 200);
    setTimeout(() => { setUploadProgress(70); setUploadStateText("Menyiapkan data..."); }, 500);

    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      startLocalFileUpload(files[0]);
    }
  };

  const clearLocalFile = () => {
    setLocalFile(null);
    setUploadProgress(0);
    setValue("contentUrl", "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // --- Google Drive Logic ---
  const handleSelectDriveFile = (file: MockDriveFile) => {
    setSelectedDriveFile(file);
    setValue("contentUrl", file.link);
    trigger("contentUrl");
    setIsDrivePickerOpen(false);
  };

  const clearDriveFile = () => {
    setSelectedDriveFile(null);
    setValue("contentUrl", "");
  };

  const handleDirectDriveUrlChange = (url: string) => {
    setDirectDriveUrl(url);
    if (url.trim().startsWith("https://") && (url.includes("drive.google.com") || url.includes("docs.google.com"))) {
      setValue("contentUrl", url);
      trigger("contentUrl");
    } else if (url.trim() === "") {
      setValue("contentUrl", "");
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
    } catch (err: any) {
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
        const dataUrl = canvas.toDataURL("image/png");
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const usePhoto = () => {
    if (capturedImage) {
      // Store actual base64 data URL — no fake URL
      setValue("contentUrl", capturedImage);
      trigger("contentUrl");
    }
  };

  const clearPhoto = () => {
    setCapturedImage(null);
    setValue("contentUrl", "");
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/modules/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSubmittedModuleName(data.title);
        setShowCelebration(true);
        reset();
        clearLocalFile();
        clearDriveFile();
        clearPhoto();
        setDirectDriveUrl("");
      } else {
        let errorMessage = "Kesalahan Tidak Diketahui";
        
        try {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
          
          // Provide specific guidance for common errors
          if (res.status === 401) {
            errorMessage = "Anda belum login. Silakan refresh halaman dan login kembali.";
          } else if (res.status === 404) {
            errorMessage = "Profil Anda belum tersinkronisasi. Silakan logout dan login kembali.";
          } else if (res.status === 400) {
            errorMessage = `Data tidak valid: ${errorMessage}`;
          } else if (res.status === 503) {
            errorMessage = "Database sedang tidak tersedia. Silakan coba lagi dalam beberapa saat.";
          } else if (res.status === 500) {
            errorMessage = "Terjadi kesalahan server. Silakan coba lagi nanti.";
          }
        } catch (parseError) {
          console.error("Error parsing response:", parseError);
        }
        
        alert(`Gagal mengirim: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Network error:", error);
      alert("Terjadi kesalahan jaringan. Pastikan Anda terhubung ke internet dan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !questionSubject.trim() || !optionA.trim() || !optionB.trim()) {
      alert("Mohon lengkapi teks pertanyaan, mata pelajaran, dan minimal opsi A & B!");
      return;
    }

    setIsQuestionSubmitting(true);
    try {
      const res = await fetch("/api/questions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: questionText.trim(),
          options: {
            A: optionA.trim(),
            B: optionB.trim(),
            C: optionC.trim() || "-",
            D: optionD.trim() || "-",
            E: optionE.trim() || "-",
          },
          answerKey: questionAnswerKey,
          difficulty: questionDifficulty,
          subject: questionSubject,
          category: questionCategory,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal mengirim soal. Coba lagi.");
        return;
      }

      setShowQuestionSuccess(true);
      // Clear fields
      setQuestionText("");
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
      setOptionE("");
      setQuestionDifficulty("sedang");
    } catch {
      alert("Terjadi kesalahan jaringan. Pastikan Anda sudah login.");
    } finally {
      setIsQuestionSubmitting(false);
    }
  };

  const filteredDriveFiles = MOCK_DRIVE_FILES.filter(file => 
    file.name.toLowerCase().includes(driveSearch.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Celebration success screen */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 transition-all duration-300">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-2xl text-center relative overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Ambient glows */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />

            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mb-6 relative">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
              <Sparkles className="h-5 w-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>

            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Kontribusi Terkirim!</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Terima kasih pejuang NAWA-LEARN! Modul <span className="font-semibold text-indigo-600 dark:text-indigo-400">"{submittedModuleName}"</span> telah masuk dalam antrean moderasi.
            </p>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-6 flex items-center justify-between text-left">
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">POTENSI HADIAH</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">+50 V-Point</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs px-2.5 py-1 rounded-md font-semibold border border-indigo-100 dark:border-indigo-950">
                Peringkat Siswa
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setShowCelebration(false)} 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-indigo-600/10 hover:shadow-lg hover:scale-[1.01]"
              >
                Kirim Modul Lain
              </button>
              <a 
                href="/leaderboard" 
                className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold py-2.5 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-1.5"
              >
                Lihat Peringkat <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Question Success Celebration Popup overlay */}
      {showQuestionSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mb-6 relative border border-emerald-200">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
              <Sparkles className="h-5 w-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>

            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Soal Berhasil Dikirim!</h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
              Soal mata pelajaran <span className="font-bold text-indigo-600 dark:text-indigo-400">"{questionSubject}"</span> telah masuk ke antrean moderator.
            </p>

            {/* Pending notice */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 mb-4 text-left flex gap-2.5 items-start">
              <span className="text-amber-500 text-base shrink-0">⏳</span>
              <div>
                <p className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300">Menunggu persetujuan moderator</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 leading-snug">
                  V-Point baru diberikan <strong>setelah moderator menyetujui</strong> soal ini. Soal sudah muncul di tab <em>Soal Saya</em> pada profilmu dengan status <em>verifikasi</em>.
                </p>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-5 flex items-center justify-between text-left">
              <div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">POIN SAAT DISETUJUI</p>
                <p className="text-base font-bold text-indigo-650 dark:text-indigo-400">
                  {questionDifficulty === "mudah" ? "+15" : questionDifficulty === "sulit" ? "+40" : "+25"} V-Point
                </p>
              </div>
              <div className={`text-xs px-2.5 py-1 rounded-md font-semibold border ${
                questionDifficulty === "mudah"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900"
                  : questionDifficulty === "sulit"
                    ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900"
              }`}>
                {questionDifficulty === "mudah" ? "Mudah" : questionDifficulty === "sulit" ? "Sulit" : "Sedang"}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                type="button"
                onClick={() => setShowQuestionSuccess(false)} 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-indigo-600/10 hover:shadow-lg active:scale-95 cursor-pointer text-xs"
              >
                Buat Soal Lain
              </button>
              <a 
                href="/profile"
                className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold py-2.5 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-1.5 text-xs border border-zinc-200 dark:border-zinc-750"
              >
                Lihat di Profilku <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Mock Picker Modal */}
      {isDrivePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
          <div className="max-w-xl w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px]">
            {/* Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-950">
                  {/* Custom Google Drive color style */}
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <path d="M19.3496 14.6508L14.6508 19.3496L19.3496 14.6508Z" fill="currentColor"/>
                    <path d="M8.8296 2.45L15.17 2.45L22.35 14.88L16 14.88L8.8296 2.45Z" fill="#FFC107"/>
                    <path d="M1.6496 15.15L8.8296 2.45L16 14.88L8.82 27.3L1.6496 15.15Z" fill="#00E676"/>
                    <path d="M16 14.88L23.17 27.3L8.82 27.3L16 14.88Z" fill="#29B6F6"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-white">Pilih dari Google Drive</h4>
                  <p className="text-xs text-zinc-500">File dokumen pembelajaran terhubung</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDrivePickerOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Cari file modul Anda..."
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 pl-10 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredDriveFiles.length > 0 ? (
                filteredDriveFiles.map((file, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSelectDriveFile(file)}
                    className="p-3 border border-zinc-150 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/20 rounded-xl cursor-pointer flex items-center justify-between group transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">{file.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] px-1.5 py-0.5 rounded font-bold">{file.type}</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{file.size}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
                  Tidak ada file yang cocok dengan pencarian Anda
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between text-xs text-zinc-400">
              <span>Google Drive API v3 (Simulator)</span>
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Terenkripsi Aman</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Header */}
      <div className="mb-8 text-center sm:text-left relative overflow-hidden bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent p-6 sm:p-8 border border-indigo-100 dark:border-zinc-800/80 rounded-3xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        
        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs px-3 py-1 rounded-full font-semibold mb-4 border border-indigo-100 dark:border-indigo-900/40">
            <Sparkles className="h-3.5 w-3.5" /> Berbagi Catatan & Dapatkan Poin
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            {submitType === "module" ? "Kontribusi Modul Pembelajaran" : "Kontribusi Kuis Latihan CBT"}
          </h2>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {submitType === "module" 
              ? "Unggah materi pembelajaran terbaikmu—baik itu ringkasan rumus matematika, rangkuman sosiologi, latihan soal olimpiade, atau catatan lainnya. Bantu teman-teman SMAN 2 Jonggol belajar lebih cepat dan kumpulkan V-Point-mu!"
              : "Buat soal latihan buatanmu sendiri! Pertanyaan kuis yang Anda ajukan akan masuk antrean moderasi pengurus OSIS. Setelah disetujui, soal akan diterbitkan secara instan di halaman latihan."}
          </p>
        </div>

        {/* Badges container */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 border-t border-zinc-200/60 dark:border-zinc-800/60 pt-6">
          {[
            { title: submitType === "module" ? "Dapatkan +15 Poin" : "Dapatkan +10 Poin", desc: "Poin setiap kontribusi yang disetujui", icon: Sparkles, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/20" },
            { title: "Moderasi < 24 Jam", desc: "Tim OSIS meninjau dengan sangat cepat", icon: ShieldCheck, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" },
            { title: submitType === "module" ? "Metode Unggah Cerdas" : "Tinjau Kunci Jawaban", desc: submitType === "module" ? "Lokal file, Drive link, atau foto" : "Opsi ganda A-E terstruktur", icon: FileUp, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20" }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{item.title}</p>
                <p className="text-xs text-zinc-550">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab selection for Submit Mode */}
      <div className="flex justify-center sm:justify-start gap-3 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <button
          onClick={() => setSubmitType("module")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
            submitType === "module"
              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
              : "bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-800 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50"
          }`}
        >
          <FolderOpen className="h-4 w-4" /> 📁 Kontribusi Modul Catatan
        </button>
        <button
          type="button"
          onClick={() => setSubmitType("question")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
            submitType === "question"
              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
              : "bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-800 text-zinc-655 dark:text-zinc-350 hover:bg-zinc-50"
          }`}
        >
          <HelpCircle className="h-4 w-4" /> ❓ Buat Soal Latihan CBT
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left side: Guide & Guidelines (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <h4 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-indigo-500" /> Aturan Berkontribusi
            </h4>
            
            <ul className="space-y-4">
              {[
                { title: "Materi Asli & Relevan", desc: "Pastikan materi adalah catatan asli atau rangkuman pribadi yang sesuai dengan kurikulum SMA." },
                { title: "Format File Terbaca", desc: "Jika mengunggah foto catatan via kamera, pastikan tulisan jelas terbaca dan pencahayaan terang." },
                { title: "Kategori Yang Sesuai", desc: "Pilihlah mata pelajaran dan kategori (UTBK/Olimpiade/Reguler) agar mudah dicari siswa lain." },
                { title: "Hindari Plagiarisme", desc: "Dilarang menyebarkan hak cipta buku komersial tanpa izin penulis." }
              ].map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{step.title}</h5>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-6 border-t border-zinc-150 dark:border-zinc-800 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Total Modul Aktif</p>
                <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  {totalActiveModules !== null ? (
                    `${totalActiveModules} Modul Belajar`
                  ) : ( 
                    <span className="inline-flex items-center gap-1.5 text-zinc-450 dark:text-zinc-550">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat...
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
            <h4 className="font-bold mb-2 flex items-center gap-1.5 text-indigo-200">
              <Sparkles className="h-4.5 w-4.5 text-amber-400" /> Liga Kontributor
            </h4>
            <p className="text-xs text-indigo-200 leading-relaxed mb-4">
              Jadilah siswa paling berpengaruh di SMAN 2 Jonggol! Modulmu akan di-download oleh teman satu angkatan. Poinmu akan diakumulasikan ke papan peringkat utama sekolah.
            </p>
            <a 
              href="/leaderboard"
              className="inline-flex items-center gap-1 bg-white hover:bg-zinc-100 text-indigo-900 text-xs px-3.5 py-1.5 rounded-lg font-bold transition-all"
            >
              Cek Papan Peringkat <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        {/* Right side: Interactive Form (lg:col-span-8) */}
        <div className="lg:col-span-8">
          {submitType === "module" ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-zinc-900 p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
              
              {/* Step 1: Judul Modul */}
              <div>
                <label className="block text-sm font-bold text-zinc-850 dark:text-zinc-200 mb-1.5">Judul Modul Pembelajaran</label>
                <input 
                  {...register("title")}
                  className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400 dark:placeholder-zinc-650 shadow-inner"
                  placeholder="e.g. Ringkasan Rumus Turunan Matematika Peminatan Kelas XI"
                />
                {errors.title && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.title.message}</p>}
              </div>

              {/* Step 2: Subject, Grade & Category Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Kelas Selector */}
                <div>
                  <label className="block text-sm font-bold text-zinc-850 dark:text-zinc-200 mb-1.5">Pilih Kelas</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["X", "XI", "XII", "Umum"].map((gradeOption) => (
                      <button
                        key={gradeOption}
                        type="button"
                        onClick={() => handleGradeSelect(gradeOption)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${
                          selectedGrade === gradeOption
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
                            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {gradeOption}
                      </button>
                    ))}
                  </div>
                  {errors.grade && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.grade.message}</p>}
                </div>

                {/* Kategori Selector */}
                <div>
                  <label className="block text-sm font-bold text-zinc-855 dark:text-zinc-200 mb-1.5">Kategori Materi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "UTBK", label: "Materi UTBK" },
                      { value: "Olimpiade", label: "Olimpiade" },
                      { value: "Reguler", label: "Reguler" }
                    ].map((categoryOption) => (
                      <button
                        key={categoryOption.value}
                        type="button"
                        onClick={() => handleCategorySelect(categoryOption.value)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${
                          selectedCategory === categoryOption.value
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
                            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {categoryOption.label}
                      </button>
                    ))}
                  </div>
                  {errors.category && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.category.message}</p>}
                </div>
              </div>

              {/* Step 3: Mata Pelajaran Grid Selector */}
              <div>
                <label className="block text-sm font-bold text-zinc-850 dark:text-zinc-200 mb-2">Pilih Mata Pelajaran</label>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {SUBJECTS.map((subj) => (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => handleSubjectSelect(subj)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                        selectedSubject === subj
                          ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold scale-[1.02]"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {subj}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input 
                    value={selectedSubject && !SUBJECTS.includes(selectedSubject) ? selectedSubject : ""}
                    onChange={(e) => handleSubjectSelect(e.target.value)}
                    className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400 shadow-inner"
                    placeholder="Atau masukkan mata pelajaran khusus (contoh: Sejarah Indonesia)"
                  />
                </div>
                {errors.subject && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.subject.message}</p>}
              </div>

              {/* Step 4: Advance File Attachment Tabs */}
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
                        setActiveUploadTab(tab.id as any);
                        // Clear streams when switching tabs
                        if (tab.id !== "camera") stopCamera();
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                        activeUploadTab === tab.id
                          ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                          : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
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
                          className="border-2 border-dashed border-zinc-250 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-600 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl py-8 px-4 cursor-pointer flex flex-col items-center justify-center group transition-all duration-300 relative overflow-hidden"
                        >
                          {/* Interactive upload icon */}
                          <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Upload className="h-6 w-6" />
                          </div>
                          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-350">
                            Pilih file atau seret file Anda di sini
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-505 mt-1">
                            Mendukung dokumen .pdf, .docx, .png, .jpg (maks. 5MB)
                          </p>
                          
                          <input 
                            type="file"
                            ref={fileInputRef}
                            onChange={handleLocalFileChange}
                            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                            className="hidden"
                          />
                        </div>
                      ) : ( 
                        <div className="text-left border border-zinc-200 dark:border-zinc-850 p-4 rounded-xl flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60 shadow-sm relative overflow-hidden">
                          {isUploading && (
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-zinc-200 dark:bg-zinc-800">
                              <div 
                                className="h-full bg-indigo-600 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{localFile.name}</p>
                              {isUploading ? (
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {uploadProgress}% - {uploadStateText}</p>
                              ) : (
                                <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-0.5">{(localFile.size / 1024 / 1024).toFixed(2)} MB • Berhasil diunggah</p>
                              )}
                            </div>
                          </div>

                          {!isUploading && (
                            <button 
                              type="button" 
                              onClick={clearLocalFile}
                              className="p-1.5 text-zinc-450 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 rounded-lg transition-all"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {fileError && (
                        <div className="p-3 border border-red-200 bg-red-50 dark:bg-red-955/30 dark:border-red-900 rounded-xl flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 text-left mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
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
                            <label className="block text-[11px] font-bold text-zinc-400 mb-1">Link Berbagi Google Drive</label>
                            <div className="relative">
                              <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                              <input 
                                type="url"
                                value={directDriveUrl}
                                onChange={(e) => handleDirectDriveUrlChange(e.target.value)}
                                className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400"
                                placeholder="https://drive.google.com/file/d/..."
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-left border border-zinc-200 dark:border-zinc-850 p-4 rounded-xl flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                              {/* Drive icon indicator */}
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                                <path d="M8.8296 2.45L15.17 2.45L22.35 14.88L16 14.88L8.8296 2.45Z" fill="currentColor"/>
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-zinc-855 dark:text-zinc-200 truncate max-w-[200px] sm:max-w-xs">{selectedDriveFile.name}</p>
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1 font-semibold"><Check className="h-3 w-3" /> Drive File Terkoneksi ({selectedDriveFile.size})</p>
                            </div>
                          </div>

                          <button 
                            type="button" 
                            onClick={clearDriveFile}
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
                        <div className="mb-4 p-3 border border-red-200 bg-red-50 dark:bg-red-955/30 dark:border-red-900 rounded-xl flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 text-left">
                          <AlertCircle className="h-5 w-5 shrink-0" />
                          <span>{cameraError}</span>
                        </div>
                      )}

                      {!isCameraActive && !capturedImage ? (
                        <div className="py-6 flex flex-col items-center">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all hover:scale-[1.01] shadow-md border border-indigo-500"
                          >
                            <Camera className="h-4.5 w-4.5" />
                            Aktifkan Kamera Live
                          </button>
                          <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-3 max-w-sm">
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
                            <img 
                              src={capturedImage!}
                              alt="Captured snapshot"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                              PREVIEW
                            </div>
                          </div>

                          <div className="flex gap-3 mt-3">
                            <button
                              type="button"
                              onClick={startCamera}
                              className="flex-1 border border-zinc-250 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
                            >
                              <RefreshCw className="h-3.5 w-3.5" /> Ambil Ulang
                            </button>
                            
                            <button
                              type="button"
                              onClick={usePhoto}
                              className={`flex-1 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-md ${
                                currentContentUrl.startsWith("https://nawa-learn.storage/photos/cam-")
                                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10 border border-emerald-600"
                                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/10 border border-indigo-600"
                              }`}
                            >
                              {currentContentUrl.startsWith("https://nawa-learn.storage/photos/cam-") ? (
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

                {currentContentUrl && (
                  <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between text-left">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-[11px] font-bold text-zinc-550 dark:text-zinc-400">File berhasil dilampirkan</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[150px] sm:max-w-xs">{currentContentUrl}</span>
                  </div>
                )}
              </div>
              {errors.contentUrl && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.contentUrl.message}</p>}

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={isSubmitting || !currentContentUrl}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none font-bold transition-all duration-200 text-sm shadow-lg shadow-indigo-600/10 hover:shadow-xl hover:scale-[1.005] active:scale-95 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    Mengirim Modul Ke Moderasi...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4.5 w-4.5 text-amber-300" />
                    Kirim Modul & Dapatkan Poin
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Custom CBT Question Submission Form */
            <form onSubmit={onSubmitQuestion} className="space-y-6 bg-white dark:bg-zinc-900 p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm text-left">
              
              {/* Question text input */}
              <div>
                <label className="block text-sm font-bold text-zinc-850 dark:text-zinc-250 mb-1.5">Pertanyaan Soal Kuis</label>
                <textarea 
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400 min-h-[120px] shadow-inner"
                  placeholder="Ketikkan deskripsi lengkap soal latihan di sini... e.g. Tentukan nilai limit x mendekati 0 untuk fungsi berikut..."
                  required
                />
              </div>

              {/* Subject & Category Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Subject Selector */}
                <div>
                  <label className="block text-sm font-bold text-zinc-855 dark:text-zinc-200 mb-1.5">Mata Pelajaran</label>
                  <select
                    value={questionSubject}
                    onChange={(e) => setQuestionSubject(e.target.value)}
                    className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white cursor-pointer"
                    required
                  >
                    <option value="">-- Pilih Mata Pelajaran --</option>
                    {SUBJECTS.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                {/* Category Selector */}
                <div>
                  <label className="block text-sm font-bold text-zinc-855 dark:text-zinc-200 mb-1.5">Kategori Ujian</label>
                  <select
                    value={questionCategory}
                    onChange={(e) => setQuestionCategory(e.target.value)}
                    className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white cursor-pointer"
                    required
                  >
                    <option value="UTBK">UTBK / SNBT</option>
                    <option value="Olimpiade">Olimpiade (OSN)</option>
                    <option value="Reguler">Ujian Harian / Reguler</option>
                  </select>
                </div>
              </div>

              {/* Difficulty + Point Preview */}
              <div>
                <label className="block text-sm font-bold text-zinc-850 dark:text-zinc-200 mb-2">
                  Tingkat Kesulitan Soal
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: "mudah",  label: "Mudah",  emoji: "🟢", pts: 15, color: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" },
                    { key: "sedang", label: "Sedang", emoji: "🟡", pts: 25, color: "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" },
                    { key: "sulit",  label: "Sulit",  emoji: "🔴", pts: 40, color: "border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" },
                  ] as const).map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setQuestionDifficulty(d.key)}
                      className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all duration-150 cursor-pointer ${
                        questionDifficulty === d.key
                          ? d.color + " shadow-md scale-[1.03]"
                          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 hover:border-zinc-400"
                      }`}
                    >
                      <span className="text-lg">{d.emoji}</span>
                      <span className="text-xs font-bold">{d.label}</span>
                      <span className="text-[10px] font-semibold opacity-80">+{d.pts} VP</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                  Poin diberikan ke akunmu saat soal disetujui moderator. Soal lebih sulit = lebih banyak V-Point!
                </p>
              </div>

              {/* Options A-E */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Opsi Pilihan Jawaban (A-E)</h4>
                
                {[
                  { label: "Opsi A", val: optionA, set: setOptionA },
                  { label: "Opsi B", val: optionB, set: setOptionB },
                  { label: "Opsi C", val: optionC, set: setOptionC },
                  { label: "Opsi D", val: optionD, set: setOptionD },
                  { label: "Opsi E", val: optionE, set: setOptionE },
                ].map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-500 select-none shrink-0 border border-zinc-200 dark:border-zinc-700">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <input 
                      type="text"
                      value={opt.val}
                      onChange={(e) => opt.set(e.target.value)}
                      className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-inner"
                      placeholder={`Isi konten jawaban untuk pilihan ${String.fromCharCode(65 + idx)}...`}
                      required={idx < 2} // A and B are required
                    />
                  </div>
                ))}
              </div>

              {/* Correct answer key selector */}
              <div>
                <label className="block text-sm font-bold text-zinc-850 dark:text-zinc-200 mb-1.5">Kunci Jawaban Benar</label>
                <select
                  value={questionAnswerKey}
                  onChange={(e) => setQuestionAnswerKey(e.target.value)}
                  className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white cursor-pointer"
                  required
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
              </div>

              {/* Submit Question Button */}
              <button 
                type="submit" 
                disabled={isQuestionSubmitting}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none font-bold transition-all duration-200 text-xs sm:text-sm shadow-lg shadow-indigo-600/10 hover:shadow-xl hover:scale-[1.005] active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-indigo-700"
              >
                {isQuestionSubmitting ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    Mengajukan Soal Ke Moderator...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4.5 w-4.5 text-amber-300" />
                    Kirim Soal Latihan & Dapatkan Poin
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}