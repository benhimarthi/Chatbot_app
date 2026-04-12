import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Link as LinkIcon, 
  Plus, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  Trash2,
  File
} from 'lucide-react';
import { Card, CustomButton as Button } from '../components/UI';
import { FileUpload } from '../components/FileUpload';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { auth, getDocuments, updateDocument, deleteDocument } from '../firebase';
import { cn } from '../lib/utils';
import { upsertDocumentToPinecone } from '../services/ragService';
import { motion, AnimatePresence } from 'motion/react';

export const DocumentsPage = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIndexing, setIsIndexing] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; docId: string | null; docName: string }>({
    isOpen: false,
    docId: null,
    docName: ''
  });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;

    const unsubscribeDocs = getDocuments(userId, (docs) => {
      setDocuments(docs);
      setIsLoading(false);
    });

    return () => {
      unsubscribeDocs();
    };
  }, []);

  const handleReindexAll = async () => {
    if (!auth.currentUser || documents.length === 0) return;
    
    setIsIndexing(true);
    try {
      for (const doc of documents) {
        if (doc.content) {
          await updateDocument(auth.currentUser.uid, doc.id, { status: 'Processing' });
          await upsertDocumentToPinecone(auth.currentUser.uid, doc.content, doc.name);
          await updateDocument(auth.currentUser.uid, doc.id, { status: 'Processed' });
        }
      }
      alert("All documents re-indexed successfully!");
    } catch (error) {
      console.error("Indexing error:", error);
      alert("Failed to index some documents.");
    } finally {
      setIsIndexing(false);
    }
  };

  const handleDelete = async () => {
    if (!auth.currentUser || !deleteModal.docId) return;
    
    setIsDeleting(true);
    try {
      await deleteDocument(auth.currentUser.uid, deleteModal.docId);
      setDeleteModal({ isOpen: false, docId: null, docName: '' });
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-500 mt-1">Upload documents and URLs to train your AI.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleReindexAll}
            disabled={isIndexing || documents.length === 0}
          >
            {isIndexing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
            Re-index All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 border-none shadow-sm bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Source</h3>
              <FileUpload />
            </Card>
            
            <Card className="p-6 border-none shadow-sm bg-indigo-600 text-white">
              <h3 className="text-lg font-bold mb-2">Pro Tip</h3>
              <p className="text-indigo-100 text-sm leading-relaxed">
                Upload PDFs or paste URLs to train your AI on specific business knowledge.
              </p>
            </Card>
          </div>

          {/* Sources List */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 border-none shadow-sm bg-white min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Active Sources</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search sources..."
                    className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              ) : documents.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-gray-300" />
                  </div>
                  <h4 className="text-gray-900 font-bold">No sources yet</h4>
                  <p className="text-gray-500 text-sm mt-1">Upload your first document to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="group flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          {doc.type === 'url' ? <LinkIcon className="w-5 h-5 text-indigo-600" /> : <FileText className="w-5 h-5 text-indigo-600" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{doc.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{doc.size || 'Web Page'}</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <div className="flex items-center gap-1">
                              {doc.status === 'Processed' ? (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              ) : (
                                <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                              )}
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                doc.status === 'Processed' ? "text-green-600" : "text-amber-600"
                              )}>
                                {doc.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setDeleteModal({ isOpen: true, docId: doc.id, docName: doc.name })}
                        className="text-gray-400 hover:text-rose-600 p-2 transition-colors"
                        title="Delete Source"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

      <DeleteConfirmModal 
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleDelete}
        title="Delete Source"
        message={`Are you sure you want to delete "${deleteModal.docName}"? This action cannot be undone.`}
        isLoading={isDeleting}
      />
    </div>
  );
};
