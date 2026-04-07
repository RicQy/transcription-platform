import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '../api/config';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
  };
};

interface StyleGuideRule {
  id: string;
  guide_id: string;
  rule_type: string;
  rule_text: string;
  source_page: number | null;
  is_active: boolean;
}

interface StyleGuide {
  id: string;
  version: string;
  storage_url: string;
  is_active: boolean;
  parsed_at: string | null;
  created_at: string;
  rules?: StyleGuideRule[];
}

export default function StyleGuideAdminPage() {
  const queryClient = useQueryClient();
  const [version, setVersion] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: guides, isLoading } = useQuery<StyleGuide[]>({
    queryKey: ['style-guides'],
    queryFn: async () => {
      const response = await fetch(getApiUrl('/style-guides'), {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch style guides');
      return response.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ version, file }: { version: string; file: File }) => {
      setError(null);
      
      const formData = new FormData();
      formData.append('version', version);
      formData.append('file', file);

      const response = await fetch(getApiUrl('/style-guides'), {
        method: 'POST',
        headers: getHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create style guide');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['style-guides'] });
      setVersion('');
      setFile(null);
      setUploading(false);
      alert('Style guide uploaded successfully!');
    },
    onError: (error: Error) => {
      console.error('Upload failed:', error);
      setError(error.message);
      setUploading(false);
    },
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !version) return;

    setUploading(true);
    setError(null);
    uploadMutation.mutate({ version, file });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Style Guides Management</h2>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h3 className="text-lg font-medium mb-4">Upload New Style Guide</h3>
        <form onSubmit={handleUpload} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Version Name</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. Legal Style Guide v1.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !file || !version}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Style Guide'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500">
          Note: Uploading a new style guide will automatically set it as the active version.
          Previous versions will be preserved but marked as inactive.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Version
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Upload Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rules Count
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : guides?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  No style guides found.
                </td>
              </tr>
            ) : (
              guides?.map((guide) => (
                <tr key={guide.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {guide.version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(guide.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {guide.is_active ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {guide.rules?.length || 0} rules
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {guides && guides.length > 0 && guides.some((g) => g.is_active && g.rules) && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium mb-4">Active Style Guide Rules</h3>
          <div className="space-y-4">
            {guides
              .find((g) => g.is_active)
              ?.rules?.map((rule) => (
                <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                      {rule.rule_type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{rule.rule_text}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
