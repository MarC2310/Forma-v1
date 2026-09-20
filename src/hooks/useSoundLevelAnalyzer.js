// forma-app-main/src/hooks/useSoundLevelAnalyzer.js
import { useState, useEffect, useRef } from 'react';

export function useSoundLevelAnalyzer(isListening, options = {}) {
  const {
    dbThreshold = 50, 
    silenceTimeout = 20000, // 20 secunde
  } = options;

  const [currentDb, setCurrentDb] = useState(0);
  const [isAboveThreshold, setIsAboveThreshold] = useState(false);
  const [apneaEvents, setApneaEvents] = useState([]);
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Stări pentru secvența reală de apnee: Sforăit/Respirație ➔ Pauză ➔ Reluare bruscă
  const wasBreathingNoiseRef = useRef(false);
  const silenceStartRef = useRef(null);
  const apneaCandidateRef = useRef(false);

  useEffect(() => {
    if (!isListening) {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      cancelAnimationFrame(animationFrameRef.current);
      wasBreathingNoiseRef.current = false;
      silenceStartRef.current = null;
      apneaCandidateRef.current = false;
      return;
    }

    async function setupAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 512;

        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
        microphoneRef.current.connect(analyserRef.current);

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const analyze = () => {
          analyserRef.current.getByteFrequencyData(dataArray);
          
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sumSquares += dataArray[i] * dataArray[i];
          }
          let rms = Math.sqrt(sumSquares / dataArray.length);
          let db = Math.min(100, Math.max(15, Math.round(rms * 1.2)));
          setCurrentDb(db);

          const now = Date.now();

          // 1. A apărut un sunet/sforăit peste prag
          if (db >= dbThreshold) {
            setIsAboveThreshold(true);
            wasBreathingNoiseRef.current = true;

            // Dacă eram în stare de candidație pentru apnee și apare un zgomot brusc (gâfâit/oftat de reluare)
            if (apneaCandidateRef.current) {
              const durationSec = Math.round((now - (silenceStartRef.current || now)) / 1000);
              setApneaEvents(prev => [
                ...prev, 
                { timestamp: new Date().toISOString(), durationSec, dbLevel: db }
              ]);
              apneaCandidateRef.current = false;
            }

            silenceStartRef.current = null;
          } else {
            setIsAboveThreshold(false);

            // 2. Este liniște — verificăm dacă a fost precedată de sforăit/respirație zgomotoasă
            if (wasBreathingNoiseRef.current) {
              if (!silenceStartRef.current) {
                silenceStartRef.current = now;
              } else if (now - silenceStartRef.current > silenceTimeout) {
                // S-a atins pragul de pauză respiratorie suspectă
                apneaCandidateRef.current = true;
              }
            }
          }

          animationFrameRef.current = requestAnimationFrame(analyze);
        };

        analyze();
      } catch (err) {
        console.error("Erore acces microfon pentru analiză sunet:", err);
      }
    }

    setupAudio();

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isListening, dbThreshold, silenceTimeout]);

  return { currentDb, isAboveThreshold, apneaEvents };
}
