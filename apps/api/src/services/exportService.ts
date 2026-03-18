import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { Transcript, TranscriptSegment, StyleGuideRule } from '@prisma/client';

type TranscriptWithSegments = Transcript & { segments: TranscriptSegment[] };

function getSpeakerFormat(rules: StyleGuideRule[]): string {
  const rule = rules.find((r) => r.ruleType === 'SpeakerFormatting');
  if (rule?.ruleText.toLowerCase().includes('all caps')) return 'upper';
  if (rule?.ruleText.toLowerCase().includes('title case')) return 'title';
  return 'default';
}

function formatSpeaker(speaker: string, format: string): string {
  if (format === 'upper') return speaker.toUpperCase();
  if (format === 'title') return speaker.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return speaker;
}

function getTimestampFormat(rules: StyleGuideRule[]): boolean {
  return rules.some((r) => r.ruleType === 'TimestampRequirement');
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function toTxt(transcript: TranscriptWithSegments, activeRules: StyleGuideRule[]): string {
  const speakerFormat = getSpeakerFormat(activeRules);
  const includeTimestamps = getTimestampFormat(activeRules);

  return transcript.segments
    .map((seg) => {
      const speaker = formatSpeaker(seg.speaker, speakerFormat);
      const ts = includeTimestamps ? ` [${formatTime(seg.startTime)}]` : '';
      return `${speaker}:${ts}\n${seg.text}`;
    })
    .join('\n\n');
}

export function toTranscribeMe(transcript: TranscriptWithSegments, activeRules: StyleGuideRule[]): string {
  // TranscribeMe format: same as TXT but always includes timestamps
  const speakerFormat = getSpeakerFormat(activeRules);
  return transcript.segments
    .map((seg) => {
      const speaker = formatSpeaker(seg.speaker, speakerFormat);
      return `${speaker} [${formatTime(seg.startTime)}]\n${seg.text}`;
    })
    .join('\n\n');
}

export async function toDocx(transcript: TranscriptWithSegments, activeRules: StyleGuideRule[]): Promise<Buffer> {
  const speakerFormat = getSpeakerFormat(activeRules);

  const paragraphs = transcript.segments.flatMap((seg: TranscriptSegment) => [
    new Paragraph({
      children: [new TextRun({ text: formatSpeaker(seg.speaker, speakerFormat), bold: true })],
    }),
    new Paragraph({ children: [new TextRun({ text: seg.text })] }),
    new Paragraph({ children: [] }), // blank line
  ]);

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}

export function toJson(transcript: TranscriptWithSegments): string {
  return JSON.stringify(
    {
      id: transcript.id,
      audioFileId: transcript.audioFileId,
      version: transcript.version,
      lastModified: transcript.lastModified,
      segments: transcript.segments.map((seg) => ({
        id: seg.id,
        speaker: seg.speaker,
        text: seg.text,
        startTime: seg.startTime,
        endTime: seg.endTime,
        confidence: seg.confidence,
        wordData: seg.wordData,
      })),
    },
    null,
    2,
  );
}
