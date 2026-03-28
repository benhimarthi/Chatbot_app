import * as React from 'react';
import { useState } from 'react';
import { Upload, File, X, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export const FileUpload = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<{ name: string; size: string; status: string }[]>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Mock file handling
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    const newFiles = droppedFiles.map(file => ({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      status: 'Processing'
    }));
    setFiles([...files, ...newFiles]);
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all duration-300',
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
            : 'border-gray-200 hover:border-gray-300 bg-gray-50/30'
        )}
      >
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-gray-100">
          <Upload className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Upload your documents</h3>
        <p className="text-gray-500 text-sm mt-1 text-center max-w-xs">
          Drag and drop your PDF, TXT or DOCX files here to train your AI
        </p>
        <button className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
          Browse Files
        </button>
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Recent Uploads</h4>
          {files.map((file, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between group animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                  <File className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{file.size} • {file.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {file.status === 'Processing' ? (
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                <button className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
