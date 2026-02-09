"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: "pdf" | "csv";
  status: "pending" | "uploading" | "parsing" | "categorizing" | "done" | "error";
  transactionCount?: number;
  errorMessage?: string;
  progress: number;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).slice(2),
      name: file.name,
      size: file.size,
      type: file.name.endsWith(".pdf") ? "pdf" : "csv",
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
    },
    multiple: true,
  });

  const processFiles = async () => {
    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;

      // Simulate processing stages
      const stages: UploadedFile["status"][] = [
        "uploading",
        "parsing",
        "categorizing",
        "done",
      ];

      for (const stage of stages) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: stage,
                  progress:
                    stage === "uploading"
                      ? 25
                      : stage === "parsing"
                      ? 50
                      : stage === "categorizing"
                      ? 75
                      : 100,
                  transactionCount:
                    stage === "done"
                      ? Math.floor(Math.random() * 80) + 40
                      : f.transactionCount,
                }
              : f
          )
        );
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
      }
    }

    setIsProcessing(false);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload Statements
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload Wells Fargo PDF statements or CSV exports. We&apos;ll parse
          and auto-categorize your transactions.
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-card/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              isDragActive ? "bg-primary/20" : "bg-secondary"
            )}
          >
            <Upload
              className={cn(
                "w-7 h-7 transition-colors",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragActive
                ? "Drop your statements here"
                : "Drag & drop bank statements"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports Wells Fargo PDF statements and CSV exports
            </p>
          </div>
          <button className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-xs font-medium transition-colors">
            Browse Files
          </button>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Files ({files.length})
              {doneCount > 0 && (
                <span className="text-emerald-400 ml-2">
                  {doneCount} processed
                </span>
              )}
            </h3>
            {pendingCount > 0 && (
              <button
                onClick={processFiles}
                disabled={isProcessing}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Process {pendingCount} files</>
                )}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50"
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    file.type === "pdf"
                      ? "bg-rose-500/10"
                      : "bg-emerald-500/10"
                  )}
                >
                  {file.type === "pdf" ? (
                    <FileText
                      className={cn(
                        "w-5 h-5",
                        file.type === "pdf"
                          ? "text-rose-400"
                          : "text-emerald-400"
                      )}
                    />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    {file.status === "done" && file.transactionCount && (
                      <span className="text-xs text-emerald-400">
                        {file.transactionCount} transactions found
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  {file.status !== "pending" && file.status !== "done" && (
                    <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="shrink-0">
                  {file.status === "pending" && (
                    <span className="text-xs text-muted-foreground">
                      Ready
                    </span>
                  )}
                  {(file.status === "uploading" ||
                    file.status === "parsing" ||
                    file.status === "categorizing") && (
                    <div className="flex items-center gap-1.5 text-xs text-primary">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {file.status === "uploading"
                        ? "Uploading..."
                        : file.status === "parsing"
                        ? "Parsing..."
                        : "Categorizing..."}
                    </div>
                  )}
                  {file.status === "done" && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  )}
                  {file.status === "error" && (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  )}
                </div>

                {/* Remove */}
                {file.status === "pending" && (
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-secondary rounded-md transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="p-6 rounded-xl border border-border bg-card/30">
        <h3 className="text-sm font-medium mb-3">How to get your statements</h3>
        <div className="space-y-3 text-xs text-muted-foreground">
          <div className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
              1
            </span>
            <p>
              Log into{" "}
              <span className="text-foreground font-medium">
                wellsfargo.com
              </span>{" "}
              → Statements & Documents → select your business checking account
            </p>
          </div>
          <div className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
              2
            </span>
            <p>
              Download each monthly statement as a{" "}
              <span className="text-foreground font-medium">PDF</span> — or go
              to Account Activity → Download and export as{" "}
              <span className="text-foreground font-medium">CSV</span>
            </p>
          </div>
          <div className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
              3
            </span>
            <p>
              Upload all 12 months here. We support{" "}
              <span className="text-foreground font-medium">
                batch upload
              </span>{" "}
              — drop them all at once.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
