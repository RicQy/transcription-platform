import { NavLink } from 'react-router-dom';
import { Role } from '@transcribe/shared-types';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  label: string;
  to: string;
}

const transcriptionistNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Upload Audio', to: '/audio/upload' },
];

const adminNav: NavItem[] = [
  ...transcriptionistNav,
  { label: 'Style Guides', to: '/admin/style-guides' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navItems = user?.role === Role.ADMIN ? adminNav : transcriptionistNav;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="w-64 bg-gray-800 text-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">TranscribePlatform</h1>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="mb-2">
          <p className="text-xs text-gray-400">Signed in as</p>
          <p className="text-sm text-white truncate">{user?.email}</p>
          <p className="text-xs text-gray-400 capitalize">{user?.role.toLowerCase()}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors text-left"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
