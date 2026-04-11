import { getApiUrl } from './config.js';

export interface Speaker {
  id: string;
  user_id: string;
  name: string;
  default_label?: string;
  created_at: string;
}

export interface AudioFileSpeaker {
  id: string;
  audio_file_id: string;
  speaker_id?: string;
  diarization_label: string;
  verified_name?: string;
  role?: string;
  created_at: string;
}

async function authedFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(getApiUrl(url), { ...options, headers });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }
  return response.json();
}

export const speakersApi = {
  getMySpeakers: (): Promise<Speaker[]> => authedFetch('/speakers'),
  
  createSpeaker: (name: string, defaultLabel?: string): Promise<Speaker> => 
    authedFetch('/speakers', {
      method: 'POST',
      body: JSON.stringify({ name, defaultLabel })
    }),

  getAudioFileSpeakers: (audioFileId: string): Promise<AudioFileSpeaker[]> => 
    authedFetch(`/audio-files/${audioFileId}/speakers`),

  updateAudioFileSpeakerLink: (audioFileId: string, data: {
    diarizationLabel: string;
    speakerId?: string;
    verifiedName?: string;
    role?: string;
  }): Promise<AudioFileSpeaker> => 
    authedFetch(`/audio-files/${audioFileId}/speakers`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
};
