'use client';

import React, { useState } from 'react';
import { Share2, Twitter, Facebook, Linkedin, Mail, Link as LinkIcon, Check } from 'lucide-react';
import { showSuccess } from '@/lib/toast';

interface ShareButtonsProps {
  url?: string;
  title?: string;
  description?: string;
  compact?: boolean;
}

const ShareButtons: React.FC<ShareButtonsProps> = ({
  url,
  title = 'NEETLogiq - Smart College Predictor',
  description = 'Find the best medical colleges based on your NEET rank',
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Use current URL if not provided
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showSuccess('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} - ${shareUrl}`)}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${description}\n\n${shareUrl}`)}`,
  };

  // Native share API (mobile)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      setShowMenu(!showMenu);
    }
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={handleNativeShare}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Share2 className="h-4 w-4" />
          <span className="text-sm font-medium">Share</span>
        </button>

        {/* Dropdown menu (desktop) */}
        {showMenu && !navigator.share && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-2 space-y-1">
              <ShareMenuItem
                icon={<Twitter className="h-4 w-4" />}
                label="Twitter"
                href={shareLinks.twitter}
              />
              <ShareMenuItem
                icon={<Facebook className="h-4 w-4" />}
                label="Facebook"
                href={shareLinks.facebook}
              />
              <ShareMenuItem
                icon={<Linkedin className="h-4 w-4" />}
                label="LinkedIn"
                href={shareLinks.linkedin}
              />
              <ShareMenuItem
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                href={shareLinks.email}
              />
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                <span className="text-sm">{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full layout
  return (
    <div className="flex flex-col space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Share</h3>

      {/* Social buttons */}
      <div className="flex flex-wrap gap-3">
        {/* WhatsApp */}
        <a
          href={shareLinks.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors shadow-lg hover:shadow-xl"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          <span className="font-medium">WhatsApp</span>
        </a>

        {/* Twitter */}
        <a
          href={shareLinks.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors shadow-lg hover:shadow-xl"
        >
          <Twitter className="h-5 w-5" />
          <span className="font-medium">Twitter</span>
        </a>

        {/* Facebook */}
        <a
          href={shareLinks.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-lg hover:shadow-xl"
        >
          <Facebook className="h-5 w-5" />
          <span className="font-medium">Facebook</span>
        </a>

        {/* LinkedIn */}
        <a
          href={shareLinks.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 px-4 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl transition-colors shadow-lg hover:shadow-xl"
        >
          <Linkedin className="h-5 w-5" />
          <span className="font-medium">LinkedIn</span>
        </a>

        {/* Email */}
        <a
          href={shareLinks.email}
          className="flex items-center space-x-2 px-4 py-3 bg-gray-700 hover:bg-gray-800 text-white rounded-xl transition-colors shadow-lg hover:shadow-xl"
        >
          <Mail className="h-5 w-5" />
          <span className="font-medium">Email</span>
        </a>
      </div>

      {/* Copy link */}
      <div className="flex items-center space-x-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
        <input
          type="text"
          value={shareUrl}
          readOnly
          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none"
        />
        <button
          onClick={handleCopyLink}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <LinkIcon className="h-4 w-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const ShareMenuItem: React.FC<{ icon: React.ReactNode; label: string; href: string }> = ({
  icon,
  label,
  href,
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
    >
      {icon}
      <span className="text-sm">{label}</span>
    </a>
  );
};

export default ShareButtons;
