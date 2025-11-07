// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged as firebaseOnAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Determine auth domain based on environment
const getAuthDomain = () => {
  // Use custom domain in production, Firebase domain for development
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'neetlogiq.com' || hostname === 'www.neetlogiq.com') {
      return 'neetlogiq.com';
    }
  }
  // Fallback to Firebase domain for development/localhost
  return 'neetlogiq-15499.firebaseapp.com';
};

const firebaseConfig = {
  apiKey: "AIzaSyBoTOrLIfgMkfr3lMQQJd3f_ZWqfi-bFjk",
  authDomain: getAuthDomain(),
  projectId: "neetlogiq-15499",
  storageBucket: "neetlogiq-15499.firebasestorage.app",
  messagingSenderId: "100369453309",
  appId: "1:100369453309:web:205c0f116b5d899580ee94",
  measurementId: "G-V4V48LV46K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Auth helper functions
export const signInWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
};

export const signOutUser = () => {
  return signOut(auth);
};

// Get JWT token for API calls
export const getAuthToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    const token = await user.getIdToken(true); // Force refresh
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Get user claims (for role-based access)
export const getUserClaims = async (): Promise<any> => {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    const idTokenResult = await user.getIdTokenResult();
    return idTokenResult.claims;
  } catch (error) {
    console.error('Error getting user claims:', error);
    return null;
  }
};

// Check if user is admin
export const isAdmin = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user?.email) return false;
  
  // Import admin configuration
  const { isAdminEmail } = await import('@/config/admin');
  
  // Check if user's email is in admin list
  const emailIsAdmin = isAdminEmail(user.email);
  
  // Also check custom claims from Firebase (fallback)
  try {
    const claims = await getUserClaims();
    const claimsIsAdmin = claims?.admin === true || claims?.role === 'admin';
    
    return emailIsAdmin || claimsIsAdmin;
  } catch (error) {
    // If claims check fails, rely on email check only
    return emailIsAdmin;
  }
};

// Get admin info for current user
export const getAdminInfo = async () => {
  const user = auth.currentUser;
  if (!user?.email) return null;
  
  const { getAdminInfo } = await import('@/config/admin');
  return getAdminInfo(user.email);
};

// Check if user has specific admin permission
export const hasAdminPermission = async (permission: string): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user?.email) return false;
  
  const { hasPermission } = await import('@/config/admin');
  return hasPermission(user.email, permission);
};

// Auth state change listener
export const onAuthStateChanged = (callback: (user: FirebaseUser | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

export type { FirebaseUser as User };

export default app;
