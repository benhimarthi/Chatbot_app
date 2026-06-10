import axios from 'axios';

const getOrigin = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const upsertDocumentToPinecone = async (
  userId: string,
  content: string,
  name: string,
  docId?: string,
  contentItems?: any[]
) => {
  const response = await axios.post(`${getOrigin()}/api/rag/upsert-document`, {
    userId,
    content,
    name,
    docId,
    contentItems
  });
  return response.data;
};

export const deleteDocumentFromPinecone = async (userId: string, docId: string) => {
  const response = await axios.post(`${getOrigin()}/api/rag/delete-document`, {
    userId,
    docId
  });
  return response.data;
};

export const prioritizeUrlLinks = async (homepageTitle: string, candidates: any[]) => {
  const response = await axios.post(`${getOrigin()}/api/rag/prioritize-links`, {
    homepageTitle,
    candidates
  });
  return response.data.topUrls || [];
};
