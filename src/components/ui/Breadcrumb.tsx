'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if not provided
  const breadcrumbs = items || generateBreadcrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center space-x-2 text-sm">
        {/* Home */}
        <li>
          <Link
            href="/"
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>

        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.href}>
            <li>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </li>
            <li>
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-gray-900 dark:text-white">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
};

// Auto-generate breadcrumbs from pathname
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const paths = pathname.split('/').filter(Boolean);

  return paths.map((path, index) => {
    const href = '/' + paths.slice(0, index + 1).join('/');
    const label = path
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return { label, href };
  });
}

export default Breadcrumb;
