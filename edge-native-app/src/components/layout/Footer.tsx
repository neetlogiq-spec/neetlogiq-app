import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © {currentYear} NeetLogIQ. All rights reserved. Built with ❤️ for medical aspirants.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;











