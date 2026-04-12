import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, updateDoc, deleteDoc, where, getDocs, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Firestore Helpers
export const addDocument = async (userId: string, docData: any) => {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'documents'), {
      ...docData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/documents`);
  }
};

export const updateDocument = async (userId: string, docId: string, docData: any) => {
  try {
    const docRef = doc(db, 'users', userId, 'documents', docId);
    await updateDoc(docRef, {
      ...docData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/documents/${docId}`);
  }
};

export const deleteDocument = async (userId: string, docId: string) => {
  try {
    const docRef = doc(db, 'users', userId, 'documents', docId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/documents/${docId}`);
  }
};

export const getDocuments = (userId: string, callback: (docs: any[]) => void) => {
  const q = query(collection(db, 'users', userId, 'documents'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(docs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/documents`);
  });
};

export const addChatMessage = async (userId: string, message: any) => {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'messages'), {
      ...message,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/messages`);
  }
};

export const getChatMessages = (userId: string, callback: (msgs: any[]) => void) => {
  const q = query(collection(db, 'users', userId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(msgs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/messages`);
  });
};

export const clearChatHistory = async (userId: string) => {
  try {
    const messagesRef = collection(db, 'users', userId, 'messages');
    const snapshot = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/messages`);
  }
};

export const updateUserSettings = async (userId: string, settings: { businessName?: string; customInstructions?: string; apiKey?: string; displayName?: string; subscriptionPlan?: string }) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
};

export const getUserSettings = (userId: string, callback: (settings: any) => void) => {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${userId}`);
  });
};

export const addNotification = async (userId: string, notification: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notification,
      userId,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'notifications');
  }
};

export const getNotifications = (userId: string, callback: (notifications: any[]) => void) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(notifications);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'notifications');
  });
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
};

// Booking Management
export const getBookings = (userId: string, callback: (bookings: any[]) => void) => {
  const q = query(
    collection(db, 'bookings'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(bookings);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'bookings');
  });
};

export const updateBookingStatus = async (bookingId: string, status: 'confirmed' | 'cancelled' | 'pending') => {
  try {
    const docRef = doc(db, 'bookings', bookingId);
    await updateDoc(docRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
  }
};

export const deleteBooking = async (bookingId: string) => {
  try {
    const docRef = doc(db, 'bookings', bookingId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `bookings/${bookingId}`);
  }
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create/Update user profile in Firestore
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        businessName: '',
        customInstructions: '',
        apiKey: ''
      });
    }
    
    return user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const logout = () => signOut(auth);

// Firestore Error Handler Wrapper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
