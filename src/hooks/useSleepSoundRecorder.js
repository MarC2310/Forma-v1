// forma-app-main/src/hooks/useSleepSoundRecorder.js
import { useState, useRef, useCallback } from 'react';

const DB_NAME = 'FormaSleepAudioDB';
const STORE_NAME = 'audioClips';
const DB_VERSION = 1;
const RETENTION_DAYS = 5;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function saveClipLocally(blob, metadata) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.add({
      blob,
      timestamp: metadata.timestamp || new Date().toISOString(),
      duration: metadata.duration || 0,
      dbLevel: metadata.dbLevel || 0
    });

    cleanupOldClips(store);
  } catch (err) {
    console.error("Erore la salvarea locală a audio-ului:", err);
  }
}

// Funcție corectată pentru generarea URL-urilor de redare din Blob-urile stocate
export async function getStoredAudioClips() {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result || [];
        const formatted = items.map(item => {
          let audioUrl = null;
          if (item.blob) {
            // Asigurăm crearea unui URL valid pentru fiecare blob recuperat
            audioUrl = URL.createObjectURL(item.blob);
          }
          return {
            id: item.id,
            timestamp: item.timestamp,
            dbLevel: item.dbLevel,
            audioUrl
          };
        });
        resolve(formatted.reverse()); // Cele mai recente primele
      };
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error("Erore la încărcarea clipurilor din DB:", err);
    return [];
  }
}

async function cleanupOldClips(store) {
  const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const request = store.openCursor();
  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const clip = cursor.value;
      const clipTime = new Date(clip.timestamp).getTime();
      if (clipTime < cutoffTime) {
        cursor.delete();
      }
      cursor.continue();
    }
  };
}

export function useSleepSoundRecorder() {
  const [isRecordingSegment, setIsRecordingSegment] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startSegmentRecording = useCallback(async (dbLevel) => {
    if (isRecordingSegment) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await saveClipLocally(audioBlob, {
          timestamp: new Date().toISOString(),
          dbLevel
        });

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecordingSegment(true);

      setTimeout(() => {
        stopSegmentRecording();
      }, 10000);

    } catch (err) {
      console.error("Erore pornire înregistrare segment somn:", err);
    }
  }, [isRecordingSegment]);

  const stopSegmentRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingSegment) {
      mediaRecorderRef.current.stop();
      setIsRecordingSegment(false);
    }
  }, [isRecordingSegment]);

  return {
    isRecordingSegment,
    startSegmentRecording,
    stopSegmentRecording
  };
}
