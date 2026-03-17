import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AudioUploadPage from '../pages/AudioUploadPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockMutateAsync = vi.fn();
vi.mock('../api/audio', () => ({
  useUploadAudio: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  AUDIO_QUERY_KEY: ['audio'],
}));

function renderUploadPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AudioUploadPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function createFile(name: string, type: string, size = 1024): File {
  const file = new File(['x'.repeat(size)], name, { type });
  return file;
}

describe('AudioUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the drop zone and upload button', () => {
    renderUploadPage();
    expect(screen.getByRole('region', { name: /file drop zone/i })).toBeInTheDocument();
    expect(screen.getByTestId('upload-button')).toBeDisabled();
  });

  it('shows selected filename after valid file is chosen', async () => {
    const user = userEvent.setup();
    renderUploadPage();

    const input = screen.getByTestId('file-input');
    const file = createFile('recording.mp3', 'audio/mpeg');
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('selected-filename')).toHaveTextContent('recording.mp3');
    });
  });

  it('enables upload button after valid file selected', async () => {
    const user = userEvent.setup();
    renderUploadPage();

    const input = screen.getByTestId('file-input');
    const file = createFile('audio.wav', 'audio/wav');
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-button')).not.toBeDisabled();
    });
  });

  it('rejects non-audio files and shows error', async () => {
    renderUploadPage();

    const input = screen.getByTestId('file-input');
    const file = createFile('document.pdf', 'application/pdf');
    // Use fireEvent to bypass the accept attribute filter in jsdom
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid file type/i);
    });
  });

  it('rejects text files and shows error', async () => {
    renderUploadPage();

    const input = screen.getByTestId('file-input');
    const file = createFile('notes.txt', 'text/plain');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid file type/i);
    });
  });

  it('accepts .flac audio files', async () => {
    const user = userEvent.setup();
    renderUploadPage();

    const input = screen.getByTestId('file-input');
    const file = createFile('audio.flac', 'audio/flac');
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('selected-filename')).toHaveTextContent('audio.flac');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls uploadAudio and navigates to dashboard on success', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ id: 'new-id' });
    renderUploadPage();

    const input = screen.getByTestId('file-input');
    const file = createFile('audio.mp3', 'audio/mpeg');
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-button')).not.toBeDisabled();
    });

    await user.click(screen.getByTestId('upload-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ file }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error when upload fails', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error('Network error'));
    renderUploadPage();

    const input = screen.getByTestId('file-input');
    const file = createFile('audio.mp3', 'audio/mpeg');
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-button')).not.toBeDisabled();
    });

    await user.click(screen.getByTestId('upload-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/upload failed/i);
    });
  });

  it('cancel button navigates to dashboard', async () => {
    const user = userEvent.setup();
    renderUploadPage();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
