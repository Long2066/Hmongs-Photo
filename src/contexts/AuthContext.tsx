
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
    User as FirebaseUser, 
    onAuthStateChanged, 
    signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { User } from '../types';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && user.emailVerified) {
                // Map Firebase User to App User Type
                const appUser: User = {
                    id: user.uid,
                    username: user.email || '',
                    name: user.displayName || user.email?.split('@')[0] || 'User',
                    avatar: user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=random`,
                };
                setCurrentUser(appUser);
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const logout = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <AuthContext.Provider value={{ currentUser, loading, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
