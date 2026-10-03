import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Notice, notifications } from './social';
import { readJSON, writeJSON } from './storage';

const SEEN = 'essola.notices.seen';

/** Forum notifications for this device's profile plus how many arrived since the list was last opened. */
export function useNotices() {
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([notifications().catch(() => [] as Notice[]), readJSON<string>(SEEN, '')]).then(([list, seen]) => {
        if (!live) return;
        setItems(list);
        setUnread(list.filter((n) => n.at > seen).length);
      });
      return () => {
        live = false;
      };
    }, []),
  );
  const markSeen = useCallback(() => {
    writeJSON(SEEN, new Date().toISOString());
    setUnread(0);
  }, []);
  return { items, unread, markSeen };
}
