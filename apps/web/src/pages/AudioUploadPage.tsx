import * as React from 'react';
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUploadAudio } from '../api/audio';
import { isConvertible, convertToPCM16kHz, loadFFmpeg } from '../utils/audioConverter';

const ACCEPTED_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-m4a',
  'audio/flac',
  'audio/webm',
  'audio/ogg',
  'audio/aac',
  'audio/ac3',
  'audio/amr',
  'audio/x-ms-wma',
  'audio/x-aiff',
  'audio/x-ape',
  'audio/opus',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/x-ms-wmv',
  'video/3gpp',
];
const ACCEPTED_EXTENSIONS = [
  '.mp3',
  '.mp4',
  '.wav',
  '.m4a',
  '.flac',
  '.webm',
  '.ogg',
  '.aac',
  '.ac3',
  '.amr',
  '.wma',
  '.aiff',
  '.ape',
  '.opus',
  '.mov',
  '.avi',
  '.mkv',
  '.wmv',
  '.3gp',
];

function isAudioFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);
}

export default function AudioUploadPage() {
  const navigate = useNavigate();
  const { mutateAsync: uploadAudio, isPending } = useUploadAudio();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Invalid file type. Accepted formats: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
    setUploadProgress(0);
    setConversionProgress(0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleUpload = async () => {
    if (!selectedFile) return;
    setError(null);
    setUploadProgress(0);
    setConversionProgress(0);

    try {
      let fileToUpload = selectedFile;

      if (isConvertible(selectedFile)) {
        setIsConverting(true);
        try {
          await loadFFmpeg();
          setFfmpegLoaded(true);
          fileToUpload = new File(
            [
              await convertToPCM16kHz(selectedFile, {
                onProgress: setConversionProgress,
              }),
            ],
            selectedFile.name.replace(/\.[^/.]+$/, '') + '.pcm',
            { type: 'audio/L16;rate=16000' },
          );
        } catch (convError) {
          console.error('Conversion failed:', convError);
          setError('Audio conversion failed. Uploading original file.');
          fileToUpload = selectedFile;
        }
        setIsConverting(false);
      }

      await uploadAudio({
        file: fileToUpload,
      });
      navigate('/dashboard');
    } catch {
      setError('Upload failed. Please try again.');
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Audio</h1>

      <div
        role="region"
        aria-label="File drop zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }`}
      >
        <svg
          className="w-10 h-10 text-gray-400 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-sm text-gray-600">
          <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-400 mt-1">{ACCEPTED_EXTENSIONS.join(', ')} (max 2 GB)</p>
        <input
          ref={fileInputRef}
          type="file"
          data-testid="file-input"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Audio file input"
        />
      </div>

      {selectedFile && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-sm font-medium text-gray-700 truncate" data-testid="selected-filename">
            {selectedFile.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md" role="alert">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isPending && (
        <div className="mt-4">
          {isConverting && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-purple-600 mb-1">
                <span>Converting to PCM 16kHz…</span>
                <span>{conversionProgress}%</span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2">
                <div
                  role="progressbar"
                  aria-valuenow={conversionProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="bg-purple-600 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${conversionProgress}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Uploading…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || isPending || isConverting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="upload-button"
        >
          {isConverting ? 'Converting…' : isPending ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </div>
  );
}
