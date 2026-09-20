// src/lib/hrvAnalysis.js — FORMA v67
// Algoritmi HRV: time domain, Poincaré, Stress Index Baevsky, LF/HF via FFT

export function filterArtifacts(rr) {
  if (!rr || rr.length < 3) return { filtered: [], artifactPct: 0 }
  const W = 9
  const filtered = []
  let removed = 0
  for (let i = 0; i < rr.length; i++) {
    if (rr[i] < 300 || rr[i] > 2000) { removed++; continue }
    const start = Math.max(0, i - Math.floor(W / 2))
    const end   = Math.min(rr.length, i + Math.ceil(W / 2))
    const win   = rr.slice(start, end).slice().sort((a, b) => a - b)
    const median = win[Math.floor(win.length / 2)]
    if (Math.abs(rr[i] - median) / median <= 0.20) filtered.push(rr[i])
    else removed++
  }
  return { filtered, artifactPct: rr.length > 0 ? Math.round((removed / rr.length) * 100) : 0 }
}

export function calcTimeDomain(rr) {
  if (!rr || rr.length < 5) return null
  const n = rr.length
  const meanRR = rr.reduce((s, r) => s + r, 0) / n
  const sdnn = Math.sqrt(rr.reduce((s, r) => s + (r - meanRR) ** 2, 0) / (n - 1))
  const diffs = []
  for (let i = 1; i < n; i++) diffs.push(rr[i] - rr[i - 1])
  const rmssd = Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length)
  const nn50  = diffs.filter(d => Math.abs(d) > 50).length
  const pnn50 = (nn50 / diffs.length) * 100
  const sd1 = rmssd / Math.sqrt(2)
  const sd2 = Math.sqrt(Math.max(0, 2 * sdnn ** 2 - sd1 ** 2))
  return {
    meanRR: Math.round(meanRR),
    hr:     Math.round(60000 / meanRR),
    sdnn:   Math.round(sdnn  * 10) / 10,
    rmssd:  Math.round(rmssd * 10) / 10,
    pnn50:  Math.round(pnn50 * 10) / 10,
    sd1:    Math.round(sd1   * 10) / 10,
    sd2:    Math.round(sd2   * 10) / 10,
  }
}

export function calcStressIndex(rr) {
  if (!rr || rr.length < 50) return null
  const min = Math.min(...rr), max = Math.max(...rr)
  const mxdmn = max - min
  if (mxdmn === 0) return null
  const BIN = 50, bins = {}
  rr.forEach(r => { const b = Math.floor(r / BIN) * BIN; bins[b] = (bins[b] || 0) + 1 })
  let maxCnt = 0, modeBin = 0
  for (const [b, cnt] of Object.entries(bins)) { if (cnt > maxCnt) { maxCnt = cnt; modeBin = Number(b) } }
  const mo  = (modeBin + BIN / 2) / 1000
  const amo = (maxCnt / rr.length) * 100
  return Math.round((amo / (2 * mo * mxdmn)) * 10) / 10
}

function fft(re, im) {
  const n = re.length
  if (n <= 1) return
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]] }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wRe = Math.cos(ang), wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0
      for (let j = 0; j < len / 2; j++) {
        const uRe=re[i+j], uIm=im[i+j]
        const vRe=re[i+j+len/2]*curRe-im[i+j+len/2]*curIm
        const vIm=re[i+j+len/2]*curIm+im[i+j+len/2]*curRe
        re[i+j]=uRe+vRe; im[i+j]=uIm+vIm
        re[i+j+len/2]=uRe-vRe; im[i+j+len/2]=uIm-vIm
        ;[curRe,curIm]=[curRe*wRe-curIm*wIm, curRe*wIm+curIm*wRe]
      }
    }
  }
}

export function calcFrequencyDomain(rr) {
  if (!rr || rr.length < 60) return null
  const times = []; let t = 0
  rr.forEach(r => { times.push(t); t += r / 1000 })
  const fs = 4, dt = 1/fs
  const tStart = times[0], tEnd = times[times.length-1]
  const nSamp = Math.floor((tEnd - tStart) * fs)
  if (nSamp < 16) return null
  let fftLen = 1; while (fftLen < nSamp) fftLen <<= 1
  const uniform = new Float64Array(fftLen)
  for (let i = 0; i < nSamp; i++) {
    const ti = tStart + i * dt
    let j = 1; while (j < times.length-1 && times[j] < ti) j++
    const alpha = times[j]>times[j-1] ? (ti-times[j-1])/(times[j]-times[j-1]) : 0
    uniform[i] = rr[j-1] + alpha*(rr[j]-rr[j-1])
  }
  let mean = 0; for (let i=0;i<nSamp;i++) mean+=uniform[i]; mean/=nSamp
  for (let i=0;i<nSamp;i++) uniform[i]-=mean
  for (let i=0;i<nSamp;i++) uniform[i]*=0.5*(1-Math.cos(2*Math.PI*i/(nSamp-1)))
  const re = Array.from(uniform), im = new Array(fftLen).fill(0)
  fft(re, im)
  const freqRes = fs/fftLen; let lf=0, hf=0, total=0
  for (let k=1;k<fftLen/2;k++) {
    const freq = k*freqRes
    const power = (re[k]*re[k]+im[k]*im[k])*2/(fftLen*fftLen)
    total+=power
    if (freq>=0.04&&freq<0.15) lf+=power
    if (freq>=0.15&&freq<=0.40) hf+=power
  }
  if (total===0) return null
  return {
    lf:    Math.round(lf*1e6)/1000,
    hf:    Math.round(hf*1e6)/1000,
    lfhf:  hf>0 ? Math.round((lf/hf)*100)/100 : null,
    lfPct: Math.round((lf/total)*100),
    hfPct: Math.round((hf/total)*100),
  }
}

export function assessQuality(artifactPct, rrCount) {
  if (rrCount<30||artifactPct>20) return {level:'very_low',   label:'CALITATE FOARTE SCĂZUTĂ', color:'#ef4444'}
  if (artifactPct>10)             return {level:'low',        label:'CALITATE SCĂZUTĂ',        color:'#f97316'}
  if (artifactPct>5)              return {level:'acceptable', label:'CALITATE ACCEPTABILĂ',    color:'#f59e0b'}
  if (artifactPct>2)              return {level:'good',       label:'CALITATE BUNĂ',           color:'#22c55e'}
  return                                 {level:'excellent',  label:'CALITATE EXCELENTĂ',      color:'#10b981'}
}

export function calcReadinessScore(rmssd, baseline7day=null) {
  if (!rmssd||rmssd<=0) return null
  const lnRmssd = Math.log(rmssd)
  if (baseline7day&&baseline7day>0) {
    const lnBase = Math.log(baseline7day)
    const delta  = (lnRmssd-lnBase)/Math.max(lnBase,0.01)
    return Math.max(1,Math.min(100,Math.round(50+delta*100)))
  }
  const score = Math.round(((lnRmssd-Math.log(20))/(Math.log(120)-Math.log(20)))*80+20)
  return Math.max(1,Math.min(100,score))
}

export function parseHRPacket(buffer) {
  const data = new DataView(buffer)
  const flags    = data.getUint8(0)
  const hrUint16 = (flags & 0x01) !== 0
  const rrFlag   = (flags & 0x10) !== 0
  let offset = 1
  const hr = hrUint16 ? data.getUint16(offset,true) : data.getUint8(offset)
  offset += hrUint16 ? 2 : 1
  const rr = []
  if (rrFlag) {
    while (offset+1 < data.byteLength) {
      rr.push(Math.round(data.getUint16(offset,true)*1000/1024))
      offset+=2
    }
  }
  return {hr, rr}
}
