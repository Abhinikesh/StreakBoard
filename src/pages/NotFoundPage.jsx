import React from 'react';
import { Navigate } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-extrabold text-indigo-600 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h2>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">The page you're looking for doesn't exist or has been moved.</p>
        <a 
          href="/dashboard" 
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-bold rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none ring-2 ring-transparent focus:ring-indigo-500 active:scale-95"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}
