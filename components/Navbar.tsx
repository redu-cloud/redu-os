import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-accent-600 rounded-lg"></div>
            <Link href="/" className="font-bold text-lg">
              reduOS
            </Link>
          </div>

          <div className="hidden md:flex gap-8">
            <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Home
            </Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/operator" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Operator
            </Link>
            <Link href="/stack" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Stack
            </Link>
            <Link href="/events" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Events
            </Link>
            <Link href="/actions" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Actions
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition"
            >
              Launch Demo
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
