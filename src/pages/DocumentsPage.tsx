import { FileUpload } from '../components/FileUpload';

export const DocumentsPage = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-gray-500">Upload documents to train your AI on your specific business data.</p>
      </div>

      <FileUpload />
    </div>
  );
};
