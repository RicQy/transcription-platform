import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import http from 'http';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { enforce } from '@transcribe/cvl-engine';
import { v4 as uuidv4 } from 'uuid';
import Replicate from 'replicate';
import Anthropic from '@anthropic-ai/sdk';
import { db } from './db.js';
import crypto from 'crypto';
import fetch from 'node-fetch';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

dotenv.config();

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });


const PORT = Number(process.env.PORT) || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'legal-transcribe-local-secret';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Auth Middleware ────────────────────────────────────────────────────────
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── Auth Endpoints ──────────────────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await db.from('users').insert([{ email, password_hash: hash }]).select().single();
    res.json({ user: { id: user.data.id, email: user.data.email, role: user.data.role } });
  } catch (err) {
    res.status(400).json({ error: 'User already exists' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: user } = await db.from('users').select('*').eq('email', email).single() as any;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ user: { id: user.id, email: user.email, role: user.role }, accessToken: token });
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', source: 'local-node-api', time: new Date() });
});

// ─── Audio & Transcription ──────────────────────────────────────────────────
app.get('/audio-files', authenticate, async (req: any, res) => {
  const files = await db.from('audio_files').select('*').execute() as any;
  res.json(files.data);
});

app.post('/upload', authenticate, upload.single('file'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const storage_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  
  try {
    const { data: audioFile } = await db.from('audio_files').insert([{
      filename: req.file.originalname,
      storage_url,
      transcription_status: 'pending',
      user_id: req.user.id
    }]).select().single() as any;
    
    res.json(audioFile);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.use('/uploads', express.static(uploadDir));

// ─── Transcripts ─────────────────────────────────────────────────────────────
app.get('/transcripts/:audioFileId', authenticate, async (req: any, res) => {
  const { audioFileId } = req.params;
  const { data: transcript } = await db.from('transcripts').select('*').eq('audio_file_id', audioFileId).single().execute() as any;
  res.json(transcript);
});

app.patch('/transcripts/:id', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { data: transcript } = await db.from('transcripts').update(req.body).eq('id', id).execute() as any;
  res.json(transcript);
});


// ─── Style Guides ────────────────────────────────────────────────────────────
app.get('/style-guides', authenticate, async (req: any, res) => {
  const guides = await db.from('style_guides').select('*').execute() as any;
  res.json(guides.data);
});

app.post('/style-guides', authenticate, upload.single('file'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { version } = req.body;
  
  const storage_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  
  try {
    const { data: guide } = await db.from('style_guides').insert([{
      version,
      storage_url,
      is_active: true
    }]).select().single() as any;
    
    res.json(guide);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

  const { audioFileId, provider = 'whisperx' } = req.body;
  if (!audioFileId) return res.status(400).json({ error: 'Missing audioFileId' });

  try {
    const { data: audioFile } = await db.from('audio_files').select('*').eq('id', audioFileId).single() as any;
    if (!audioFile) return res.status(404).json({ error: 'File not found' });

    io.emit(`audio:${audioFileId}:status`, { status: 'TRANSCRIPTION_STARTED' });
    await db.from('audio_files').update({ transcription_status: 'processing' }).eq('id', audioFileId).execute();

    transcribeAsync(audioFileId, audioFile.storage_url, provider);

    res.status(202).json({ status: 'processing', audioFileId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function transcribeAsync(audioFileId: string, storageUrl: string, provider: string) {
  try {
    io.emit(`audio:${audioFileId}:progress`, { status: 'asr_active' });
    let rawText = '';
    let transcriptionData: any = {};

    if (provider === 'whisperx') {
      const output = await replicate.run(
        "victor-upmeet/whisperx:84d2627e7d68a98f1f5035fcd7a31b67f1b74d47cbaf0effda9930fca56ec483",
        { input: { audio: storageUrl, batch_size: 64, align_output: true } }
      );
      transcriptionData = output;
      const segments = Array.isArray(output) ? output : (output as any).segments;
      rawText = segments ? segments.map((s: any) => s.text).join(' ') : (String((output as any).text) || '');
    } else {
      rawText = "Alternative provider transcription results.";
    }

    io.emit(`audio:${audioFileId}:raw_completed`, { text: rawText });

    // LLM Styling (Anthropic)
    const { data: activeGuide } = await db.from('style_guides').select('id').eq('is_active', true).single() as any;
    let finalOutput = rawText;
    if (activeGuide) {
      const { data: rules } = await db.from('style_guide_rules').select('*').eq('guide_id', activeGuide.id).execute() as any;
      if (rules?.length > 0) {
        io.emit(`audio:${audioFileId}:styling`, { status: 'applying_rules' });
        finalOutput = await applyStyleGuideDirect(rawText, rules);
      }
    }

    // CVL Enforcement
    io.emit(`audio:${audioFileId}:cvl`, { status: 'enforcing_cvl' });
    const cvlResult = enforce(finalOutput);

    // Save Transcript
    await db.from('transcripts').insert([{
      audio_file_id: audioFileId,
      style_guide_id: activeGuide?.id || null,
      raw_transcription: JSON.stringify(transcriptionData),
      content: { raw: rawText, llm_cleaned: finalOutput, formatted: cvlResult.text, stats: cvlResult.stats },
      full_text: cvlResult.text,
      status: 'completed',
      completed_at: new Date().toISOString()
    }]).select().single();

    await db.from('audio_files').update({ transcription_status: 'completed' }).eq('id', audioFileId).execute();
    io.emit(`audio:${audioFileId}:finished`, { text: cvlResult.text });

  } catch (err) {
    console.error(err);
    io.emit(`audio:${audioFileId}:error`, { error: String(err) });
  }
}

async function applyStyleGuideDirect(text: string, rules: any[]): Promise<string> {
  const rulesText = rules.map((r: any) => `- ${r.rule_type}: ${r.rule_text}`).join('\n');
  const prompt = `You are a legal transcription formatter. Apply these rules strictly:\n${rulesText}\n\nReturn ONLY the formatted text.`;
  const msg = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 4000,
    messages: [{ role: "user", content: `${prompt}\n\nText:\n${text}` }]
  });
  return (msg.content[0] as any).text || text;
}

server.listen(PORT, () => {
  console.log(`Legal Transcribe Node API (Pure Local) running on http://localhost:${PORT}`);
});
