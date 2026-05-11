import { Directory, File, Paths } from 'expo-file-system';
import type { StateStorage } from 'zustand/middleware';

function storeDir() {
  return new Directory(Paths.document, 'store');
}

function storeFile(key: string): File {
  return new File(storeDir(), encodeURIComponent(key) + '.json');
}

export const fileSystemStorage: StateStorage = {
  async getItem(key) {
    const dir = storeDir();
    if (!dir.exists) return null;
    const file = storeFile(key);
    if (!file.exists) return null;
    return file.text();
  },

  setItem(key, value) {
    const dir = storeDir();
    if (!dir.exists) dir.create({ intermediates: true });
    storeFile(key).write(value);
  },

  removeItem(key) {
    const file = storeFile(key);
    if (file.exists) file.delete();
  },
};
