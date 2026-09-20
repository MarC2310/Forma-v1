import React, { useState, useEffect, useRef } from 'react';
import { useSoundLevelAnalyzer } from '../hooks/useSoundLevelAnalyzer';
import { useBLE } from '../context/BLEContext';
import { getStoredAudioClips } from '../hooks/useSleepSoundRecorder';
import SplineChart from './SplineChart';

export default function SleepSoundRecorder({ c, isDark }) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [sessionLog, setSessionLog] = useState([]);
  const [sessionPoints, setSessionPoints] = useState([]); 
  const [archiveClips, setArchiveClips] = useState([]);
  const [showArchive, setShowArchive] = useState(false);
  
  // Praguri ajustate: dbThreshold crescut la 62 dB pentru a evita zgomotele minore
  const { currentDb, isAboveThreshold, apneaEvents } = useSoundLevelAnalyzer(isMonitoring, {
    dbThreshold: 62,
    silenceTimeout: 30000 
  });

  const { hr, status, connect, disconnect } = useBLE();
  const isConnected = status === 'connected';

  const loadArchive = async () => {
    const clips = await getStoredAudioClips();
    setArchiveClips(clips);
    setShowArchive(true);
  };

  useEffect(() => {
    let wakeLock = null;
    if (isMonitoring && 'wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(wl => { wakeLock = wl; })
        .catch(err => console.log('WakeLock indisponibil:', err));
    }
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [isMonitoring]);

  useEffect(() => {
    getStoredAudioClips().then(clips => {
      setArchiveClips(clips);
    });
  }, []);

  useEffect(() => {
    if (isMonitoring && hr) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setSessionPoints(prev => [...prev, { hr, timeStr }]);
    }
  }, [isMonitoring, hr]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (!isMonitoring) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (isAboveThreshold && !mediaRecorderRef.current) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const newLogItem = {
            id: Date.now(),
            category: 'snoring', 
            label: '💤 Sforăit detectat',
            details: `Nivel acustic: ${currentDb} dB`,
            time: timeStr, 
            hr: hr || '--', 
            audioUrl,
            durationMinutes: 0.5 // Durata efectivă a clipului înregistrat (ex: 30 secunde / 0.5 minute sau ajustabil)
          };

          setSessionLog(prev => [newLogItem, ...prev]);
          const updatedClips = await getStoredAudioClips();
          setArchiveClips(updatedClips);

          stream.getTracks().forEach(track => track.stop());
          mediaRecorderRef.current = null;
        };

        recorder.start();
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }, 10000); // 10 secunde de înregistrare per eveniment

      }).catch(err => console.error("Erore acces microfon:", err));
    }
  }, [isAboveThreshold, isMonitoring, currentDb, hr]);

  useEffect(() => {
    if (apneaEvents.length > 0 && isMonitoring) {
      const latestEvent = apneaEvents[apneaEvents.length - 1];
      if (latestEvent.durationSec && latestEvent.durationSec < 15) return;

      const timeStr = new Date(latestEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      setSessionLog(prev => [
        { 
          id: Date.now(),
          category: 'apnea', 
          label: '⚠️ Posibilă Apnee', 
          details: `Pauză respiratorie confirmată (~${latestEvent.durationSec || 20} secunde)`, 
          time: timeStr, 
          hr: hr || '--', 
          audioUrl: null 
        },
        ...prev
      ]);
    }
  }, [apneaEvents, hr, isMonitoring]);

  const hrs = sessionPoints.map(p => p.hr).filter(v => typeof v === 'number');
  const minHr = hrs.length > 0 ? Math.min(...hrs) : null;
  const maxHr = hrs.length > 0 ? Math.max(...hrs) : null;
  const avgHr = hrs.length > 0 ? (hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(2) : null;

  const apneaCount = sessionLog.filter(l => l.category === 'apnea').length;
  const snoringLogs = sessionLog.filter(l => l.category === 'snoring');

  // Adunarea efectivă a minutelor din evenimentele înregistrate
  const totalSnoringMinutes = snoringLogs.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
  const hours = Math.floor(totalSnoringMinutes / 60);
  const minutes = Math.round(totalSnoringMinutes % 60);
  const formattedSnoringTime = hours > 0 
    ? `${hours} ore și ${minutes} minute` 
    : `${minutes} minute`;

  const s = {
    card: { background: c.card, borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: c.shadowCard, border: `1px solid ${c.border || '#334155'}`, fontFamily: c.fontFamily },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: `1px solid ${c.border2 || '#1e293b'}` },
    badgeActive: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '11px', fontWeight: 600 },
    badgeIdle: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', background: 'rgba(100, 116, 139, 0.15)', color: c.text4 || '#94a3b8', fontSize: '11px', fontWeight: 600 },
    subCard: { background: c.card2 || '#1e293b', borderRadius: '14px', padding: '1rem', border: `1px solid ${c.border2 || '#334155'}` },
    buttonStart: { width: '100%', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#ffffff', fontWeight: 700, padding: '0.85rem', borderRadius: '14px', border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' },
    buttonStop: { width: '100%', background: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)', color: '#ffffff', fontWeight: 700, padding: '0.85rem', borderRadius: '14px', border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)' },
    buttonArchive: { width: '100%', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 600, padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.3)', cursor: 'pointer', fontSize: '13px', marginTop: '10px' },
    statBox: { flex: 1, textAlign: 'center', padding: '0.75rem', borderRadius: '10px', background: 'rgba(0,0,0,0.15)', border: `1px solid ${c.border2}` },
    summaryBox: { background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '14px', padding: '1rem', marginBottom: '1rem' }
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            🌙
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: c.text || '#f8fafc', margin: 0 }}>Monitorizare Somn & Arhivă Audio</h3>
            <p style={{ fontSize: '11px', color: c.text4 || '#94a3b8', margin: '2px 0 0 0' }}>
              {isMonitoring ? '🔴 Sesiune de noapte activă (Filtru zgomot activ)...' : 'Sistem pregătit'}
            </p>
          </div>
        </div>

        <div>
          {isMonitoring ? <span style={s.badgeActive}>● Activ</span> : <span style={s.badgeIdle}>○ Standby</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* REZUMATUL NOPȚII DIN ADUNAREA EFECTIVĂ A TIMPILOR */}
        <div style={s.summaryBox}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '8px' }}>
            📋 Rezumatul Nopții & Evenimente
          </div>
          <div style={{ fontSize: '13px', color: c.text || '#f8fafc', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>
              ⚠️ Ai avut <strong>{apneaCount} evenimente de apnee</strong>. {apneaCount > 0 ? 'Verifică înregistrările din jurnal.' : 'Niciun episod detectat.'}
            </div>
            <div>
              💤 Ai sforăit în total <strong>{formattedSnoringTime}</strong> ({snoringLogs.length} înregistrări capturate). 
              {snoringLogs.length > 0 ? (
                <span 
                  style={{ color: '#818cf8', cursor: 'pointer', textDecoration: 'underline', marginLeft: '6px', fontWeight: 600 }} 
                  onClick={() => {
                    const el = document.getElementById('jurnal-evenimente');
                    if(el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  [ VEZI ÎNREGISTRĂRILE AUDIO / PLAY ]
                </span>
              ) : (
                <span style={{ color: c.text4, marginLeft: '6px', fontStyle: 'italic' }}>(Niciun clip de sforăit înregistrat încă în această sesiune)</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <button onClick={loadArchive} style={s.buttonArchive}>
            📂 Deschide Arhiva Înregistrărilor Stocate ({archiveClips.length} clipuri pe telefon)
          </button>
        </div>

        {showArchive && (
          <div style={s.subCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>Arhivă Înregistrări Locale (IndexedDB)</span>
              <button onClick={() => setShowArchive(false)} style={{ fontSize: '11px', color: c.text4, background: 'transparent', border: 'none', cursor: 'pointer' }}>✕ Închide</button>
            </div>
            
            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {archiveClips.length === 0 ? (
                <div style={{ fontSize: '12px', color: c.text4, textAlign: 'center', padding: '10px', fontStyle: 'italic' }}>
                  Nu există înregistrări audio salvate în baza de date locală.
                </div>
              ) : (
                archiveClips.map((clip) => (
                  <div key={clip.id} style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${c.border2}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: c.text4 }}>
                      <span>📅 {new Date(clip.timestamp).toLocaleString()}</span>
                      <span>Volum: <strong>{clip.dbLevel} dB</strong></span>
                    </div>
                    {clip.audioUrl ? (
                      <audio controls src={clip.audioUrl} style={{ width: '100%', height: '32px' }} />
                    ) : (
                      <div style={{ fontSize: '11px', color: '#fb7185', fontStyle: 'italic' }}>Fișier audio indisponibil.</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={s.subCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: c.text4 || '#94a3b8', textTransform: 'uppercase' }}>Zgomot Ambiental (Prag 62dB)</span>
              <span>🔊</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#818cf8' }}>
              {currentDb} <span style={{ fontSize: '12px', fontWeight: 400, color: c.text4 }}>dB</span>
            </div>
          </div>

          <div style={s.subCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: c.text4 || '#94a3b8', textTransform: 'uppercase' }}>Puls Noapte (BLE)</span>
              <span>💓</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#fb7185' }}>
              {isConnected ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{hr ? `${hr}` : '---'} <span style={{ fontSize: '12px', fontWeight: 400, color: c.text4 }}>bpm</span></span>
                  <button onClick={disconnect} style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', border: 'none', cursor: 'pointer' }}>Deconectare</button>
                </div>
              ) : (
                <button onClick={connect} style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                  Conectare Senzor BLE
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={s.subCard}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: c.text4 || '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
            Statistici Puls Sesiune
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={s.statBox}>
              <div style={{ fontSize: '10px', color: c.text4 }}>Minim</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8' }}>{minHr != null ? `${minHr} bpm` : '—'}</div>
            </div>
            <div style={s.statBox}>
              <div style={{ fontSize: '10px', color: c.text4 }}>Medie</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#facc15' }}>{avgHr != null ? `${avgHr} bpm` : '—'}</div>
            </div>
            <div style={s.statBox}>
              <div style={{ fontSize: '10px', color: c.text4 }}>Maxim</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fb7185' }}>{maxHr != null ? `${maxHr} bpm` : '—'}</div>
            </div>
          </div>
        </div>

        <div style={s.subCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: c.text4 || '#94a3b8', textTransform: 'uppercase' }}>Evoluție Temporală Puls (BPM / Oră)</span>
            <span style={{ fontSize: '11px', color: c.text4 }}>{sessionPoints.length} măsurători</span>
          </div>

          {sessionPoints.length < 2 ? (
            <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: c.text4, fontStyle: 'italic' }}>
              Graficul va genera curba temporală după acumularea primelor puncte din sesiune...
            </div>
          ) : (
            <SplineChart
              data={sessionPoints.map(p => p.hr)}
              labels={sessionPoints.map(p => p.timeStr)}
              color="#fb7185"
              height={110}
              c={c}
              formatValue={v => `${v} bpm`}
            />
          )}
        </div>

        <div>
          {!isMonitoring ? (
            <button onClick={() => { setSessionPoints([]); setIsMonitoring(true); }} style={s.buttonStart}>
              🚀 Pornește Sesiunea de Noapte
            </button>
          ) : (
            <button onClick={() => setIsMonitoring(false)} style={s.buttonStop}>
              ⏹️ Oprește Sesiunea de Noapte
            </button>
          )}
        </div>

        <div id="jurnal-evenimente">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: c.text4 || '#94a3b8', textTransform: 'uppercase' }}>Jurnal Evenimente Sesiune Curentă ({sessionLog.length})</span>
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sessionLog.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', border: `1px dashed ${c.border2}`, borderRadius: '12px', fontSize: '12px', color: c.text4, fontStyle: 'italic' }}>
                Niciun eveniment capturat în sesiunea curentă.
              </div>
            ) : (
              sessionLog.map((log) => (
                <div key={log.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0.75rem 1rem', borderRadius: '12px', background: c.card2, border: `1px solid ${c.border2}`, fontSize: '12px', color: c.text }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                      <span>{log.category === 'apnea' ? '⚠️' : '💤'}</span>
                      <span>{log.label}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: c.text4 }}>{log.time}</span>
                  </div>

                  <div style={{ fontSize: '11px', color: c.text4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{log.details}</span>
                    <span>Puls: <strong style={{ color: '#fb7185' }}>{log.hr} bpm</strong></span>
                  </div>

                  {log.audioUrl && (
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#818cf8' }}>▶ PLAY AUDIO:</span>
                      <audio controls src={log.audioUrl} style={{ width: '100%', height: '36px' }} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
