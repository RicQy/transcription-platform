import { useStyleGuides, useActivateGuide } from '../../api/styleGuide'
import { Link } from 'react-router-dom'

export default function StyleGuideListPage() {
  const { data: guides, isLoading } = useStyleGuides()
  const { mutate: activate, isPending } = useActivateGuide()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Style Guides</h1>
        <Link
          to="/admin/style-guides/upload"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          Upload New Guide
        </Link>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      {guides && guides.length === 0 && (
        <p className="text-gray-400">No style guides uploaded yet.</p>
      )}

      {guides && guides.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {guides.map((guide) => (
                <tr key={guide.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{guide.version}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(guide.uploadDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {guide.isActive ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-3">
                    <Link
                      to={`/admin/style-guides/${guide.id}/rules`}
                      className="text-blue-600 hover:underline"
                    >
                      Edit Rules
                    </Link>
                    {!guide.isActive && (
                      <button
                        type="button"
                        onClick={() => activate(guide.id)}
                        disabled={isPending}
                        className="text-green-600 hover:underline disabled:opacity-50"
                        data-testid={`activate-${guide.id}`}
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
