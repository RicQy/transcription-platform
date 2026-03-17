import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AudioStatus } from '@transcribe/shared-types';
import type { AudioFileDto } from '@transcribe/shared-types';
import type { UseQueryResult } from '@tanstack/react-query';
import DashboardPage from '../pages/DashboardPage';

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => mockSocket,
}));

vi.mock('../api/audio', () => ({
  AUDIO_QUERY_KEY: ['audio'],
  useAudioList: vi.fn(),
}));

import { useAudioList } from '../api/audio';

const mockAudioFiles: AudioFileDto[] = [
  {
    id: 'file-1',
    filename: 'interview.mp3',
    duration: 125,
    uploadDate: '2026-01-15T10:30:00.000Z',
    status: AudioStatus.QUEUED,
  },
  {
    id: 'file-2',
    filename: 'lecture.wav',
    duration: 3600,
    uploadDate: '2026-01-14T08:00:00.000Z',
    status: AudioStatus.COMPLETE,
  },
];

function createMockQueryResult<T>(overrides: Partial<UseQueryResult<T>>): UseQueryResult<T> {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
    fetchStatus: 'idle',
    status: 'success',
    error: null,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isInitialLoading: false,
    isLoadingError: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    ...overrides,
  } as unknown as UseQueryResult<T>;
}

function createMockAudioQueryResult(overrides: Partial<UseQueryResult<AudioFileDto[]>>): UseQueryResult<AudioFileDto[]> {
  return createMockQueryResult<AudioFileDto[]>(overrides);
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', () => {
    vi.mocked(useAudioList).mockReturnValue(createMockAudioQueryResult({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
      isPending: true,
      isFetching: true,
    }));

    renderDashboard();
    expect(screen.getByText(/loading audio files/i)).toBeInTheDocument();
  });

  it('shows error state when fetch fails', () => {
    vi.mocked(useAudioList).mockReturnValue(createMockAudioQueryResult({
      data: undefined,
      isLoading: false,
      isError: true,
      isSuccess: false,
      isPending: false,
      isFetching: false,
    }));

    renderDashboard();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('shows empty state when no files', () => {
    vi.mocked(useAudioList).mockReturnValue(createMockAudioQueryResult({
      data: [],
      isLoading: false,
      isError: false,
      isSuccess: true,
      isPending: false,
      isFetching: false,
    }));

    renderDashboard();
    expect(screen.getByText(/no audio files yet/i)).toBeInTheDocument();
  });

  it('renders audio list with filenames', () => {
    vi.mocked(useAudioList).mockReturnValue(createMockAudioQueryResult({
      data: mockAudioFiles,
      isLoading: false,
      isError: false,
      isSuccess: true,
      isPending: false,
      isFetching: false,
    }));

    renderDashboard();
    expect(screen.getByText('interview.mp3')).toBeInTheDocument();
    expect(screen.getByText('lecture.wav')).toBeInTheDocument();
  });

  it('renders status badges for each file', () => {
    vi.mocked(useAudioList).mockReturnValue(createMockAudioQueryResult({
      data: mockAudioFiles,
      isLoading: false,
      isError: false,
      isSuccess: true,
      isPending: false,
      isFetching: false,
    }));

    renderDashboard();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('shows Open Editor link only for COMPLETE files', () => {
    vi.mocked(useAudioList).mockReturnValue(createMockAudioQueryResult({
      data: mockAudioFiles,
      isLoading: false,
      isError: false,
      isSuccess: true,
      isPending: false,
      isFetching: false,
    }));

    renderDashboard();
    expect(screen.getByRole('link', { name: /open editor/i })).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('registers transcript:status socket listener on mount', () => {
    vi.mocked(useAudioList).mockReturnValue(createMockAudioQueryResult({
      data: mockAudioFiles,
      isLoading: false,
      isError: false,
      isSuccess: true,
      isPending: false,
      isFetching: false,
    }));

    renderDashboard();
    expect(mockSocket.on).toHaveBeenCalledWith('transcript:status', expect.any(Function));
  });

  it('updates status badge when transcript:status socket event fires', () => {
    vi.mocked(useAudioList).mockReturnValue(createMockAudioQueryResult({
      data: mockAudioFiles,
      isLoading: false,
      isError: false,
      isSuccess: true,
      isPending: false,
      isFetching: false,
    }));

    const { queryClient } = renderDashboard();

    // Pre-seed the cache so the socket handler has data to update
    queryClient.setQueryData(['audio'], mockAudioFiles);

    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'transcript:status',
    )?.[1] as ((payload: { audioId: string; status: AudioStatus }) => void) | undefined;

    expect(handler).toBeDefined();

    act(() => {
      handler!({ audioId: 'file-1', status: AudioStatus.PROCESSING });
    });

    const cached = queryClient.getQueryData<AudioFileDto[]>(['audio']);
    const updated = cached?.find((f) => f.id === 'file-1');
    expect(updated?.status).toBe(AudioStatus.PROCESSING);
  });

  it('removes socket listener on unmount', () => {
    vi.mocked(useAudioList).mockReturnValue(createMockAudioQueryResult({
      data: [],
      isLoading: false,
      isError: false,
      isSuccess: true,
      isPending: false,
      isFetching: false,
    }));

    const { unmount } = renderDashboard();
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('transcript:status', expect.any(Function));
  });
});
