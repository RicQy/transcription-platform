import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;

const CORE_URLS = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
];

async function fetchFile(file: File | Blob): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpegLoaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }: { message: string }) => {
    console.log('[FFmpeg]', message);
  });

  ffmpeg.on('progress', ({ progress }: { progress: number }) => {
    console.log('[FFmpeg] Progress:', Math.round(progress * 100) + '%');
  });

  for (const url of CORE_URLS) {
    try {
      await ffmpeg.load({
        coreURL: url,
        wasmURL: url.replace('.js', '.wasm'),
      });
      ffmpegLoaded = true;
      console.log('[FFmpeg] Loaded successfully');
      break;
    } catch (e) {
      console.warn('[FFmpeg] Failed to load from', url, e);
    }
  }

  if (!ffmpegLoaded) {
    throw new Error('Failed to load FFmpeg');
  }

  return ffmpeg;
}

export type ConvertOptions = {
  onProgress?: (percent: number) => void;
};

const OUTPUT_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'mp4',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ac3': 'ac3',
  'audio/amr': 'amr',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/x-ms-wmv': 'wmv',
  'video/3gpp': '3gp',
};

const INPUT_EXTENSIONS: Record<string, string> = {
  mp3: 'mp3',
  m4a: 'm4a',
  wav: 'wav',
  flac: 'flac',
  ogg: 'ogg',
  webm: 'webm',
  aac: 'aac',
  ac3: 'ac3',
  amr: 'amr',
  mp4: 'mp4',
  mov: 'mov',
  avi: 'avi',
  mkv: 'mkv',
  wmv: 'wmv',
  '3gp': '3gp',
  wma: 'wma',
  aiff: 'aiff',
  ape: 'ape',
  opus: 'opus',
};

export function getExtension(mimeType: string, filename: string): string {
  if (mimeType && OUTPUT_EXTENSIONS[mimeType]) {
    return OUTPUT_EXTENSIONS[mimeType];
  }
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return INPUT_EXTENSIONS[ext] || 'mp3';
}

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    aac: 'audio/aac',
    ac3: 'audio/ac3',
    amr: 'audio/amr',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    wmv: 'video/x-ms-wmv',
    '3gp': 'video/3gpp',
    wma: 'audio/x-ms-wma',
    aiff: 'audio/aiff',
    ape: 'audio/x-ape',
    opus: 'audio/opus',
  };
  return mimeMap[ext || ''] || 'audio/mpeg';
}

export async function convertAudio(
  file: File,
  targetFormat: 'mp3' | 'wav' | 'pcm' | 'm4a' | 'ogg' = 'mp3',
  options: ConvertOptions = {},
): Promise<Blob> {
  const { onProgress } = options;

  const ffmpeg = await loadFFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 100));
  });

  const inputExt = getExtension(file.type, file.name);
  const inputName = `input.${inputExt}`;
  const outputName = `output.${targetFormat}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const isAudioOnly =
    targetFormat === 'mp3' ||
    targetFormat === 'wav' ||
    targetFormat === 'pcm' ||
    targetFormat === 'm4a' ||
    targetFormat === 'ogg';

  let args: string[];
  if (isAudioOnly) {
    args = ['-i', inputName, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputName];
  } else {
    args = ['-i', inputName, '-c:v', 'copy', '-c:a', 'libmp3lame', '-q:a', '2', outputName];
  }

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pcm: 'audio/L16;rate=16000',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
  };

  return new Blob([new Uint8Array(Array.from(data as Uint8Array))], {
    type: mimeTypes[targetFormat] || 'audio/mpeg',
  });
}

export async function convertToPCM16kHz(file: File, options: ConvertOptions = {}): Promise<Blob> {
  const { onProgress } = options;

  const ffmpeg = await loadFFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 100));
  });

  const inputExt = getExtension(file.type, file.name);
  const inputName = `input.${inputExt}`;
  const outputName = 'output.wav';

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  await ffmpeg.exec([
    '-i',
    inputName,
    '-acodec',
    'pcm_s16le',
    '-ar',
    '16000',
    '-ac',
    '1',
    '-y',
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return new Blob([new Uint8Array(Array.from(data as Uint8Array))], { type: 'audio/wav' });
}

export async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audioContext = new AudioContext();
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        resolve(audioBuffer.duration);
      } catch {
        resolve(0);
      }
    };

    reader.onerror = () => resolve(0);
    reader.readAsArrayBuffer(file);
  });
}

export function isConvertible(file: File): boolean {
  const supportedMimes = new Set([
    ...Object.keys(OUTPUT_EXTENSIONS),
    'audio/x-ms-wma',
    'audio/x-aiff',
    'audio/x-ape',
    'audio/opus',
  ]);

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const supportedExts = new Set([...Object.keys(INPUT_EXTENSIONS)]);

  return supportedMimes.has(file.type) || supportedExts.has(ext);
}
