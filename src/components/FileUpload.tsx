import * as React from 'react';
import { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

import axios from 'axios';

interface FileUploadProps {
  onComplete?: () => void;
}

export const FileUpload = ({ onComplete }: FileUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [processedChunks, setProcessedChunks] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Only PDF files are supported at this time.');
        return;
      }
      if (selectedFile.size === 0) {
        setError('The selected file appears to be empty or not yet downloaded from your cloud provider (Google Drive/OneDrive). Please ensure the file is available locally before uploading.');
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) {
        setError('File size must be less than 20MB.');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !auth.currentUser) return;

    setIsUploading(true);
    setUploadProgress(10);
    setError(null);

    try {
      if (!auth.currentUser) {
        throw new Error('You must be logged in to upload documents.');
      }

      console.log('[FileUpload] Starting upload for:', file.name);
      const formData = new FormData();
      formData.append('file', file);

      console.log('[FileUpload] Getting ID token...');
      const idToken = await auth.currentUser.getIdToken();
      console.log('[FileUpload] ID token retrieved.');
      
      setUploadProgress(30);
      
      console.log('[FileUpload] Posting to /api/process/pdf via axios...');
      const response = await axios.post('/api/process/pdf', formData, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          // Map 0-100% upload to 30-70% total progress
          setUploadProgress(30 + (percentCompleted * 0.4));
        }
      });

      console.log('[FileUpload] Response received:', response.status);
      
      if (response.data.chunks) {
        setProcessedChunks(response.data.chunks);
      }
      
      setUploadProgress(90);
      setSuccess(true);
      setUploadProgress(100);
      
      // Auto-close after success so user can see it in the list
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 2000);

    } catch (err: any) {
      console.error('Upload error:', err);
      let message = 'Failed to upload document';
      if (err.response) {
        // Server responded with a status code outside the 2xx range
        message = err.response.data?.error || `Server error: ${err.response.status}`;
      } else if (err.request) {
        // Request was made but no response was received
        message = 'No response from server. Please check your connection.';
      } else {
        // Something happened in setting up the request
        message = err.message;
      }
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed border-gray-200 rounded-xl p-12 text-center cursor-pointer transition-all",
            "hover:border-black/20 hover:bg-gray-50 group"
          )}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf"
          />
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-900 font-medium">Click to upload or drag and drop</p>
          <p className="text-gray-500 text-sm mt-1">PDF files up to 20MB</p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {file.size > 0 
                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
                    : 'Unknown size (Cloud placeholder)'}
                </p>
              </div>
            </div>
            {!isUploading && !success && (
              <button
                onClick={() => setFile(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-black transition-all duration-300"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Processing document...
                </span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          )}

          {success && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Document saved to Knowledge Base!
              </div>
              
              {processedChunks.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Extracted Chunks ({processedChunks.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {processedChunks.map((chunk: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white border border-gray-100 rounded-lg text-xs text-gray-600 leading-relaxed shadow-sm">
                        <span className="font-bold text-black/40 mr-2">#{idx + 1}</span>
                        {chunk.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isUploading && !success && (
            <button
              onClick={handleUpload}
              className="w-full mt-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Start Processing
            </button>
          )}
        </div>
      )}
    </div>
  );
};
