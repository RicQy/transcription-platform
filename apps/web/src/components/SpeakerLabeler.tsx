import * as React from 'react';
import { useEffect, useState } from 'react';
import { speakersApi, type Speaker, type AudioFileSpeaker } from '../api/speakers.js';

interface SpeakerLabelerProps {
  audioFileId: string;
}

export function SpeakerLabeler({ audioFileId }: SpeakerLabelerProps) {
  const [fileSpeakers, setFileSpeakers] = useState<AudioFileSpeaker[]>([]);
  const [globalSpeakers, setGlobalSpeakers] = useState<Speaker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingSpeaker, setIsAddingSpeaker] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fSpeakers, gSpeakers] = await Promise.all([
        speakersApi.getAudioFileSpeakers(audioFileId),
        speakersApi.getMySpeakers()
      ]);
      setFileSpeakers(fSpeakers);
      setGlobalSpeakers(gSpeakers);
    } catch (err) {
      console.error('Failed to load speaker data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [audioFileId]);

  const handleLink = async (diarizationLabel: string, speakerId: string) => {
    try {
      const speaker = globalSpeakers.find(s => s.id === speakerId);
      await speakersApi.updateAudioFileSpeakerLink(audioFileId, {
        diarizationLabel,
        speakerId,
        verifiedName: speaker?.name
      });
      await loadData();
    } catch (err) {
      alert('Failed to link speaker');
    }
  };

  const handleCreateAndLink = async (diarizationLabel: string) => {
    if (!newSpeakerName.trim()) return;
    try {
      const newSpeaker = await speakersApi.createSpeaker(newSpeakerName);
      await speakersApi.updateAudioFileSpeakerLink(audioFileId, {
        diarizationLabel,
        speakerId: newSpeaker.id,
        verifiedName: newSpeaker.name
      });
      setNewSpeakerName('');
      setIsAddingSpeaker(false);
      await loadData();
    } catch (err) {
      alert('Failed to create speaker');
    }
  };

  if (isLoading) return <div className="p-4 text-gray-500 text-sm">Loading speakers...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Speaker Identification</h3>
        <button 
          onClick={() => setIsAddingSpeaker(!isAddingSpeaker)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          {isAddingSpeaker ? 'Cancel' : '+ New Profile'}
        </button>
      </div>

      {isAddingSpeaker && (
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <input
            type="text"
            placeholder="Speaker Name"
            value={newSpeakerName}
            onChange={(e) => setNewSpeakerName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setIsAddingSpeaker(false)}
            className="mt-2 w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition"
          >
            Create Global Profile
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {fileSpeakers.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-400 italic">No speakers identified yet.</p>
          </div>
        )}
        {fileSpeakers.map((fs) => (
          <div key={fs.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{fs.diarization_label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${fs.speaker_id ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {fs.speaker_id ? 'Verified' : 'Unidentified'}
              </span>
            </div>
            
            <div className="relative">
              <select
                value={fs.speaker_id || ''}
                onChange={(e) => handleLink(fs.diarization_label, e.target.value)}
                className="w-full pl-3 pr-10 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              >
                <option value="">Select Identity...</option>
                {globalSpeakers.map(gs => (
                  <option key={gs.id} value={gs.id}>{gs.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {fs.verified_name && (
              <p className="text-xs text-gray-500 italic">Mapped to: <span className="font-medium text-gray-700">{fs.verified_name}</span></p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
