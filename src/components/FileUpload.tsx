import * as React from 'react';
import { useState, useRef } from 'react';
import { Upload, File, X, CheckCircle2, Globe, Plus, Loader2, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, addDocument, updateDocument, addNotification } from '../firebase';
import * as pdfjsLib from 'pdfjs-dist';
import { upsertDocumentToPinecone, prioritizeUrlLinks } from '../services/ragService';
import axios from 'axios';

// Initialize PDF.js worker
// Using a Vite-native URL to load the worker from the node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

export const FileUpload = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }
    return fullText;
  };

  const extractTextFromTXT = async (file: File): Promise<string> => {
    return await file.text();
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!auth.currentUser) return;
    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        let content = '';
        if (file.type === 'application/pdf') {
          content = await extractTextFromPDF(file);
        } else if (file.type === 'text/plain') {
          content = await extractTextFromTXT(file);
        } else {
          console.warn('Unsupported file type:', file.type);
          continue;
        }

        if (!content || content.trim().length === 0) {
          console.warn('No text content extracted from file:', file.name);
          alert(`Could not extract any text from "${file.name}". The file might be empty or scanned as an image.`);
          continue;
        }

        // Add to Firestore
        const docId = await addDocument(auth.currentUser.uid, {
          userId: auth.currentUser.uid,
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          status: 'Processing',
          type: 'file',
          content: content.substring(0, 50000), // Limit content size for Firestore
          mimeType: file.type
        });

        if (docId) {
          // Index to Pinecone
          await upsertDocumentToPinecone(auth.currentUser.uid, content, file.name, docId);
          
          // Update status in Firestore
          await updateDocument(auth.currentUser.uid, docId, { status: 'Processed' });

          // Add notification
          await addNotification(auth.currentUser.uid, {
            title: 'Document Processed',
            message: `"${file.name}" has been successfully indexed and is ready for AI analysis.`,
            type: 'success'
          });
        }
      }
      alert("Documents uploaded and indexed successfully!");
    } catch (error) {
      console.error('Error uploading files:', error);
      alert("Failed to process some documents.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !auth.currentUser) return;
    setIsUploading(true);

    try {
      // Step 1: Discover Source and Links
      const discoveryResponse = await axios.post('/api/process/url', { url });
      const { homepage, candidates } = discoveryResponse.data;

      if (!homepage) {
        alert("Could not extract any content from the website. It might be protected or empty.");
        return;
      }

      const results = [homepage];

      // Step 2: Prioritize Links using AI (Frontend-side)
      if (candidates && candidates.length > 0) {
        const topUrls = await prioritizeUrlLinks(homepage.title, candidates);
        
        if (topUrls.length > 0) {
          // Step 3: Scrape Prioritized Pages
          const scrapeResponse = await axios.post('/api/process/url', { urls: topUrls });
          if (scrapeResponse.data.results) {
            results.push(...scrapeResponse.data.results);
          }
        }
      }

      // Step 4: Process all collected results
      for (const page of results) {
        const docId = await addDocument(auth.currentUser.uid!, {
          userId: auth.currentUser.uid,
          name: page.title || page.url,
          size: 'N/A',
          status: 'Processing',
          type: 'url',
          content: page.text.substring(0, 50000),
          mimeType: 'text/html',
          url: page.url
        });

        if (docId) {
          // Index to Pinecone with contentItems for image association
          await upsertDocumentToPinecone(auth.currentUser.uid!, page.text, page.url, docId, page.contentItems);
          
          // Update status in Firestore
          await updateDocument(auth.currentUser.uid!, docId, { status: 'Processed' });
        }
      }

      // Add notification with final count
      await addNotification(auth.currentUser.uid!, {
        title: 'Website Indexed',
        message: `Successfully indexed ${results.length} highly relevant pages from ${url}.`,
        type: 'success'
      });
      
      setUrl('');
      alert(`Website content indexed successfully! (${results.length} pages)`);
    } catch (error) {
      console.error('Error adding URL:', error);
      alert("Failed to scrape website. Make sure the URL is valid and accessible.");
    } finally {
      setIsUploading(false);
    }
  };

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
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-8">
      {/* File Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden',
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
            : 'border-gray-200 hover:border-gray-300 bg-gray-50/30'
        )}
      >
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-sm font-bold text-gray-900 uppercase tracking-widest">Processing Knowledge...</p>
          </div>
        )}
        
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-gray-100">
          <Upload className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Upload your documents</h3>
        <p className="text-gray-500 text-sm mt-2 text-center max-w-xs leading-relaxed">
          Drag and drop your <span className="font-bold text-gray-700">PDF</span> or <span className="font-bold text-gray-700">TXT</span> files here to train your AI.
        </p>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          accept=".pdf,.txt"
          multiple
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          Browse Files
        </button>
      </div>

      {/* URL Input */}
      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Globe className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Add Website URL</h3>
            <p className="text-xs text-gray-500">Import content directly from any website.</p>
          </div>
        </div>
        
        <form onSubmit={handleUrlSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/about"
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm"
            />
          </div>
          <button 
            type="submit"
            disabled={!url.trim() || isUploading}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </form>
      </div>
    </div>
  );
};
