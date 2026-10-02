import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Admins are recognised by the SHA-256 of their sign-in email, so the address itself is not in the app.
const ADMINS = ['5d94e597ea00166f5be0b0512fa5847f2f44bd49f682d6c8644f6571f434d32c'];

/** True when the signed-in user is an essola admin (CSV import and other tools). */
export function useIsAdmin() {
  const { user } = useAuth();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    const email = user?.email?.trim().toLowerCase();
    if (!email) return setAdmin(false);
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email)
      .then((h) => setAdmin(ADMINS.includes(h)))
      .catch(() => setAdmin(false));
  }, [user?.email]);
  return admin;
}
