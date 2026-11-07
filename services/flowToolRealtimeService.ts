import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../src/firebaseConfig';

/** Watch the admin-managed Flow link; reads only the public appConfig document. */
export const subscribeToFlowToolUrl = (
    onUrl: (url: string | null) => void,
    onError?: (error: Error) => void
): (() => void) => onSnapshot(doc(db, 'appConfig', 'flowTool'), snapshot => {
    onUrl(snapshot.exists() && typeof snapshot.data().url === 'string' ? snapshot.data().url : null);
}, error => onError?.(error));
