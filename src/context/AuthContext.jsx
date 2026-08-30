import { createContext, useContext, useEffect, useState } from "react";
import { signInWithGoogle, signOut, subscribeToAuthChanges, getSession, upsertProfile } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((u) => { setUser(u); setLoading(false); });
    const unsubscribe = subscribeToAuthChanges(async (u) => {
      if (u) {
        await upsertProfile({ id: u.id, email: u.email, name: u.user_metadata?.full_name || "" }).catch(console.error);
      }
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login: signInWithGoogle, logout: signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
