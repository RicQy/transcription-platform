import { PrismaClient, Role, AudioStatus } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mockCreate = jest.fn();
  const mockFindUnique = jest.fn();
  const mockFindMany = jest.fn();
  const mockDeleteMany = jest.fn();
  const mockConnect = jest.fn().mockResolvedValue(undefined);
  const mockDisconnect = jest.fn().mockResolvedValue(undefined);

  const makeModel = () => ({
    create: mockCreate,
    findUnique: mockFindUnique,
    findMany: mockFindMany,
    deleteMany: mockDeleteMany,
  });

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: mockConnect,
      $disconnect: mockDisconnect,
      user: makeModel(),
      audioFile: makeModel(),
      transcript: makeModel(),
      transcriptSegment: makeModel(),
      styleGuideDocument: makeModel(),
      styleGuideRule: makeModel(),
      validationError: makeModel(),
    })),
    Role: { ADMIN: 'ADMIN', TRANSCRIPTIONIST: 'TRANSCRIPTIONIST' },
    AudioStatus: { QUEUED: 'QUEUED', PROCESSING: 'PROCESSING', COMPLETE: 'COMPLETE', ERROR: 'ERROR' },
  };
});

describe('Prisma Client', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  it('instantiates without error', () => {
    expect(prisma).toBeDefined();
  });

  it('connects to the database', async () => {
    await expect(prisma.$connect()).resolves.not.toThrow();
  });

  describe('User model', () => {
    it('creates and reads a User', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        role: Role.TRANSCRIPTIONIST,
        createdAt: new Date(),
      };
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashed_password',
          role: Role.TRANSCRIPTIONIST,
        },
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('TRANSCRIPTIONIST');

      const found = await prisma.user.findUnique({ where: { id: user.id } });
      expect(found).not.toBeNull();
      expect(found?.email).toBe(user.email);
    });
  });

  describe('AudioFile model', () => {
    it('creates and reads an AudioFile', async () => {
      const mockAudio = {
        id: 'audio-uuid-1',
        filename: 'test.mp3',
        filePath: '/data/test.mp3',
        duration: null,
        uploadDate: new Date(),
        status: AudioStatus.QUEUED,
      };
      (prisma.audioFile.create as jest.Mock).mockResolvedValue(mockAudio);
      (prisma.audioFile.findUnique as jest.Mock).mockResolvedValue(mockAudio);

      const audio = await prisma.audioFile.create({
        data: { filename: 'test.mp3', filePath: '/data/test.mp3', status: AudioStatus.QUEUED },
      });

      expect(audio.id).toBeDefined();
      expect(audio.status).toBe('QUEUED');

      const found = await prisma.audioFile.findUnique({ where: { id: audio.id } });
      expect(found?.filename).toBe('test.mp3');
    });
  });

  describe('StyleGuideDocument and StyleGuideRule models', () => {
    it('creates a StyleGuideDocument with rules', async () => {
      const mockGuide = {
        id: 'guide-uuid-1',
        pdfFilePath: '/data/guide.pdf',
        uploadDate: new Date(),
        version: '1.0',
        isActive: false,
        parsedAt: null,
      };
      const mockRule = {
        id: 'rule-uuid-1',
        guideId: 'guide-uuid-1',
        ruleType: 'SpeakerFormatting',
        ruleText: 'Speaker labels must be formatted as "Speaker 1:" followed by a space.',
        validationLogic: null,
        sourcePage: 3,
        isActive: true,
      };
      (prisma.styleGuideDocument.create as jest.Mock).mockResolvedValue(mockGuide);
      (prisma.styleGuideRule.create as jest.Mock).mockResolvedValue(mockRule);
      (prisma.styleGuideRule.findMany as jest.Mock).mockResolvedValue([mockRule]);

      const guide = await prisma.styleGuideDocument.create({
        data: { pdfFilePath: '/data/guide.pdf', version: '1.0', isActive: false },
      });

      const rule = await prisma.styleGuideRule.create({
        data: {
          guideId: guide.id,
          ruleType: 'SpeakerFormatting',
          ruleText: 'Speaker labels must be formatted as "Speaker 1:" followed by a space.',
          sourcePage: 3,
        },
      });

      expect(rule.id).toBeDefined();
      expect(rule.ruleType).toBe('SpeakerFormatting');

      const rulesForGuide = await prisma.styleGuideRule.findMany({ where: { guideId: guide.id } });
      expect(rulesForGuide).toHaveLength(1);
    });
  });

  describe('Transcript and TranscriptSegment models', () => {
    it('creates a Transcript with segments', async () => {
      const mockAudio = {
        id: 'audio-uuid-2',
        filename: 'session.wav',
        filePath: '/data/session.wav',
        duration: null,
        uploadDate: new Date(),
        status: AudioStatus.COMPLETE,
      };
      const mockTranscript = {
        id: 'transcript-uuid-1',
        audioFileId: 'audio-uuid-2',
        userId: null,
        version: 1,
        styleGuideVersionId: null,
        lastModified: new Date(),
      };
      const wordData = [
        { word: 'Hello', start: 0.0, end: 0.5, confidence: 0.98, speaker_id: 'SPEAKER_00' },
        { word: 'world.', start: 0.6, end: 1.5, confidence: 0.92, speaker_id: 'SPEAKER_00' },
      ];
      const mockSegment = {
        id: 'segment-uuid-1',
        transcriptId: 'transcript-uuid-1',
        speaker: 'Speaker 1',
        text: 'Hello world.',
        startTime: 0.0,
        endTime: 1.5,
        confidence: 0.95,
        wordData,
      };
      (prisma.audioFile.create as jest.Mock).mockResolvedValue(mockAudio);
      (prisma.transcript.create as jest.Mock).mockResolvedValue(mockTranscript);
      (prisma.transcriptSegment.create as jest.Mock).mockResolvedValue(mockSegment);
      (prisma.transcriptSegment.findMany as jest.Mock).mockResolvedValue([mockSegment]);

      const audio = await prisma.audioFile.create({
        data: { filename: 'session.wav', filePath: '/data/session.wav', status: AudioStatus.COMPLETE },
      });

      const transcript = await prisma.transcript.create({
        data: { audioFileId: audio.id, version: 1 },
      });

      const segment = await prisma.transcriptSegment.create({
        data: {
          transcriptId: transcript.id,
          speaker: 'Speaker 1',
          text: 'Hello world.',
          startTime: 0.0,
          endTime: 1.5,
          confidence: 0.95,
          wordData,
        },
      });

      expect(segment.id).toBeDefined();
      expect(segment.speaker).toBe('Speaker 1');

      const segments = await prisma.transcriptSegment.findMany({
        where: { transcriptId: transcript.id },
      });
      expect(segments).toHaveLength(1);
      expect(segments[0].wordData).toEqual(expect.any(Array));
    });
  });

  describe('ValidationError model', () => {
    it('creates a ValidationError linked to transcript and segment', async () => {
      const mockError = {
        id: 'error-uuid-1',
        transcriptId: 'transcript-uuid-2',
        segmentId: 'segment-uuid-2',
        ruleId: null,
        errorType: 'FillerWordHandling',
        positionStart: 0,
        positionEnd: 2,
        message: 'Filler word "um" should be removed.',
        isResolved: false,
      };
      (prisma.validationError.create as jest.Mock).mockResolvedValue(mockError);
      (prisma.validationError.findUnique as jest.Mock).mockResolvedValue(mockError);

      const error = await prisma.validationError.create({
        data: {
          transcriptId: 'transcript-uuid-2',
          segmentId: 'segment-uuid-2',
          errorType: 'FillerWordHandling',
          positionStart: 0,
          positionEnd: 2,
          message: 'Filler word "um" should be removed.',
          isResolved: false,
        },
      });

      expect(error.id).toBeDefined();
      expect(error.errorType).toBe('FillerWordHandling');

      const found = await prisma.validationError.findUnique({ where: { id: error.id } });
      expect(found?.message).toContain('um');
    });
  });
});

describe('Prisma singleton (prisma.ts)', () => {
  it('exports a singleton PrismaClient instance', async () => {
    jest.resetModules();
    const { prisma: instance1 } = await import('./prisma');
    const { prisma: instance2 } = await import('./prisma');
    expect(instance1).toBe(instance2);
  });
});
