import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold mb-4">reduOS</h3>
            <p className="text-sm text-gray-600">
              Open-source AI operating system for startup teams.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-sm">Product</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/dashboard" className="hover:text-gray-900">Dashboard</Link></li>
              <li><Link href="/operator" className="hover:text-gray-900">Operator</Link></li>
              <li><Link href="/stack" className="hover:text-gray-900">Stack</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-sm">Learn</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="#" className="hover:text-gray-900">Documentation</a></li>
              <li><a href="#" className="hover:text-gray-900">GitHub</a></li>
              <li><a href="#" className="hover:text-gray-900">Community</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-sm">Company</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="#" className="hover:text-gray-900">About</a></li>
              <li><a href="#" className="hover:text-gray-900">Blog</a></li>
              <li><a href="#" className="hover:text-gray-900">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-8 flex items-center justify-between">
          <p className="text-sm text-gray-600">© 2026 reduOS. Part of redu.cloud.</p>
          <p className="text-sm text-gray-600">Open source | Apache 2.0</p>
        </div>
      </div>
    </footer>
  );
}
