import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, updateDoc, deleteDoc, where, getDocs, increment, limit } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { PLANS } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Determine which database ID is active from server-verified configuration (self-healing)
let activeDatabaseId = firebaseConfig.firestoreDatabaseId;
try {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/firebase/config', false); // Synchronous call to fetch verified Firestore database
  xhr.send(null);
  if (xhr.status === 200) {
    const data = JSON.parse(xhr.responseText);
    if (data.databaseId) {
      activeDatabaseId = data.databaseId;
      console.log(`[Firebase Client] Dynamically routed to database: "${activeDatabaseId}"`);
    }
  }
} catch (e) {
  console.warn('[Firebase Client] Failed to fetch server firestore config, using default config:', e);
}

export const db = (activeDatabaseId && activeDatabaseId !== "(default)" && activeDatabaseId !== "") 
  ? getFirestore(app, activeDatabaseId) 
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

// Firestore Helpers
export const addDocument = async (userId: string, docData: any) => {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'documents'), {
      ...docData,
      createdAt: serverTimestamp()
    });
    
    // Increment document usage
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'usage.documents_count': increment(1)
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

    // Decrement document usage
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'usage.documents_count': increment(-1)
    });
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
  let snapshot;
  try {
    const messagesRef = collection(db, 'users', userId, 'messages');
    snapshot = await getDocs(messagesRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/messages`);
    return;
  }

  try {
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
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
  return onSnapshot(userRef, async (snapshot) => {
    if (snapshot.exists()) {
      let settings = snapshot.data();
      
      // Check for monthly reset
      const now = new Date();
      const lastReset = settings.usage?.current_period_start?.toDate() || new Date(0);
      const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceReset >= 30) {
        try {
          await updateDoc(userRef, {
            'usage.messages_this_month': 0,
            'usage.bookings_this_month': 0,
            'usage.current_period_start': serverTimestamp()
          });
          // snapshot will re-trigger with new data
        } catch (e) {
          console.error("Failed to reset usage:", e);
        }
      }
      
      callback(settings);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${userId}`);
  });
};

export const incrementMessageUsage = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'usage.messages_this_month': increment(1)
    });
  } catch (error) {
    console.error("Failed to increment message usage:", error);
  }
};

export const incrementBookingUsage = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'usage.bookings_this_month': increment(1)
    });
  } catch (error) {
    console.error("Failed to increment booking usage:", error);
  }
};

export const requestUpgrade = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      upgrade_requested: true
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
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

export const updateLastActive = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      lastActiveAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to update last active:", error);
  }
};

export const getCustomers = (userId: string, callback: (customers: any[]) => void) => {
  const q = query(collection(db, 'users', userId, 'customers'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(docs);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/customers`);
  });
};

export const getUserLogs = (userId: string, callback: (logs: any[]) => void) => {
  const q = query(collection(db, 'users', userId, 'logs'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(docs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/logs`);
  });
};

export const logEvent = async (userId: string, type: string, message: string, metadata?: any) => {
  try {
    await addDoc(collection(db, 'users', userId, 'logs'), {
      type,
      message,
      metadata: metadata || {},
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log event:", error);
  }
};

export const clearUserLogs = async (userId: string) => {
  try {
    const logsRef = collection(db, 'users', userId, 'logs');
    const snapshot = await getDocs(logsRef);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/logs`);
  }
};

export const getAllUsers = (callback: (users: any[]) => void) => {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(docs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'users');
  });
};

export const upsertCustomer = async (userId: string, name: string, phone: string, email?: string) => {
  try {
    // Create a deterministic ID based on phone to avoid duplicates
    const customerId = `cust_${phone.replace(/\D/g, '')}`;
    const customerRef = doc(db, 'users', userId, 'customers', customerId);
    const snap = await getDoc(customerRef);
    
    if (snap.exists()) {
      const data = snap.data();
      await updateDoc(customerRef, {
        name,
        email: email || data.email || '',
        totalBookings: increment(1),
        lastBookingAt: serverTimestamp()
      });
    } else {
      await setDoc(customerRef, {
        userId,
        name,
        phone,
        email: email || '',
        totalBookings: 1,
        lastBookingAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Failed to upsert customer:", error);
  }
};

export const getReservationsForAdmin = (filters: { businessId?: string }, callback: (reservations: any[]) => void) => {
  let q = query(collection(db, 'reservations'), orderBy('created_at', 'desc'));
  
  if (filters.businessId) {
    q = query(collection(db, 'reservations'), where('business_id', '==', filters.businessId), orderBy('created_at', 'desc'));
  }

  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(docs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'reservations');
  });
};

export const addReservation = async (reservation: any) => {
  try {
    const docRef = await addDoc(collection(db, 'reservations'), {
      ...reservation,
      created_at: serverTimestamp()
    });
    
    // Also upsert customer
    await upsertCustomer(reservation.business_id, reservation.customer_name, reservation.customer_phone);
    
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'reservations');
  }
};

export const getReservationsInRange = async (businessId: string, date: string, startTime: string, endTime: string) => {
  try {
    // We fetch all reservations for that business on that date to do client-side overlap check
    // because Firestore doesn't support complex inequality on multiple fields easily for range overlaps
    const q = query(
      collection(db, 'reservations'),
      where('business_id', '==', businessId),
      where('date', '==', date),
      where('status', '==', 'confirmed')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'reservations');
    return [];
  }
};

export const getReservations = (businessId: string, callback: (reservations: any[]) => void) => {
  const q = query(
    collection(db, 'reservations'),
    where('business_id', '==', businessId),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(reservations);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'reservations');
  });
};

export const deleteReservation = async (reservationId: string) => {
  try {
    const docRef = doc(db, 'reservations', reservationId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `reservations/${reservationId}`);
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
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
        apiKey: '',
        role: 'user',
        subscriptionPlan: 'free',
        bookingEnabled: false,
        chatbotEnabled: true,
        isChatbotBlocked: false,
        isApiAccessBlocked: false,
        usage: {
          messages_this_month: 0,
          bookings_this_month: 0,
          documents_count: 0,
          current_period_start: serverTimestamp()
        }
      });
    } else {
      // Ensure usage fields exist for older users
      const data = userDoc.data();
      const updates: any = {};
      
      if (!data.usage) {
        updates.usage = {
          messages_this_month: 0,
          bookings_this_month: 0,
          documents_count: 0,
          current_period_start: data.createdAt || serverTimestamp()
        };
      }
      
      if (data.chatbotEnabled === undefined) updates.chatbotEnabled = true;
      if (data.isChatbotBlocked === undefined) updates.isChatbotBlocked = false;
      if (data.isApiAccessBlocked === undefined) updates.isApiAccessBlocked = false;

      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
      }
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
