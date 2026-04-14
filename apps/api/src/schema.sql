-- Initial Schema for Legal Transcribe (Non-InsForge)

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  filename TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  storage_key TEXT,
  transcription_status TEXT DEFAULT 'pending',
  transcript_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_file_id UUID REFERENCES audio_files(id),
  style_guide_id UUID,
  raw_transcription JSONB,
  content JSONB,
  full_text TEXT,
  status TEXT DEFAULT 'processing',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS style_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  jurisdiction TEXT, -- e.g. "US-FL", "CA-ON"
  source_url TEXT, -- Link to uploaded style guide PDF/DOCX
  source_key TEXT, -- R2 key
  version INT DEFAULT 1,
  is_published BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS style_guide_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES style_guides(id),
  rule_type TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  default_label TEXT, -- e.g. "Attorney", "Judge", "Witness"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audio_file_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_file_id UUID REFERENCES audio_files(id),
  speaker_id UUID REFERENCES speakers(id),
  diarization_label TEXT NOT NULL, -- e.g. "Speaker 0" from WhisperX
  verified_name TEXT, 
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(audio_file_id, diarization_label)
);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID REFERENCES transcripts(id),
  gold_standard_text TEXT NOT NULL,
  wer DECIMAL(5,2), -- Word Error Rate
  cer DECIMAL(5,2), -- Character Error Rate
  alignment_data JSONB, -- Diff data for highlighting
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed an admin user (use bcrypt/argon2 hashing for the password)
-- IMPORTANT: Replace the placeholder hash below with a real bcrypt hash before running.
-- Generate one with: node -e "require('bcrypt').hash('YOUR_PASSWORD',10).then(h=>console.log(h))"
INSERT INTO users (email, password_hash, role) 
VALUES ('admin@legal.app', '$2b$10$REPLACE_WITH_REAL_BCRYPT_HASH', 'admin')
ON CONFLICT DO NOTHING;
