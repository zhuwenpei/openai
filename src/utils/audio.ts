/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Satisfying Skeuomorphic Click / Tactile Pop Sound
 */
export function playSndClick(volume = 0.5, enabled = true, mode: "mahjong" | "mouse" = "mouse") {
  if (!enabled) return;
  if (mode === "mahjong") {
    playSndMahjong(volume, enabled);
  } else {
    playSndMouseClick(volume, enabled);
  }
}

/**
 * Tactile Mahjong Tile Collision Sound (麻将音)
 * Crisp ceramic bone tile impact with high-Q resonance.
 */
export function playSndMahjong(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Ceramic High-Impact Transient (High Q metallic/porcelain resonance)
    const oscHigh = ctx.createOscillator();
    const gainHigh = ctx.createGain();
    oscHigh.type = "sine";
    oscHigh.frequency.setValueAtTime(2150, now);
    oscHigh.frequency.exponentialRampToValueAtTime(1600, now + 0.025);

    gainHigh.gain.setValueAtTime(volume * 0.22, now);
    gainHigh.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

    oscHigh.connect(gainHigh);
    gainHigh.connect(ctx.destination);

    // Ceramic Tile Body Resonance (Dense bone/tile clack)
    const oscBody = ctx.createOscillator();
    const gainBody = ctx.createGain();
    oscBody.type = "triangle";
    oscBody.frequency.setValueAtTime(980, now);
    oscBody.frequency.exponentialRampToValueAtTime(420, now + 0.035);

    gainBody.gain.setValueAtTime(volume * 0.18, now);
    gainBody.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    oscBody.connect(gainBody);
    gainBody.connect(ctx.destination);

    oscHigh.start(now);
    oscBody.start(now);
    oscHigh.stop(now + 0.04);
    oscBody.stop(now + 0.04);
  } catch (e) {
    console.error("Audio error:", e);
  }
}

/**
 * Mechanical Mouse Switch Click Sound (鼠标点击音)
 * Snappy tactile microswitch click.
 */
export function playSndMouseClick(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // High frequency click snap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(3400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.012);

    gain.gain.setValueAtTime(volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Subtle low-end switch release rebound
    const oscLow = ctx.createOscillator();
    const gainLow = ctx.createGain();
    oscLow.type = "triangle";
    oscLow.frequency.setValueAtTime(500, now + 0.003);
    oscLow.frequency.exponentialRampToValueAtTime(200, now + 0.018);

    gainLow.gain.setValueAtTime(volume * 0.12, now + 0.003);
    gainLow.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    oscLow.connect(gainLow);
    gainLow.connect(ctx.destination);

    osc.start(now);
    oscLow.start(now + 0.003);
    osc.stop(now + 0.02);
    oscLow.stop(now + 0.025);
  } catch (e) {
    console.error("Audio error:", e);
  }
}

/**
 * Premium Upgrade Sound with Popcorn Cascade
 * Combines a beautiful mechanical rising chime with a fast 1-2-3 satisfying pop-sequence.
 */
export function playSndUpgrade(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Chime notes: C4 -> E4 -> G4 -> C5
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.08);

      gain.gain.setValueAtTime(0, now + index * 0.08);
      gain.gain.linearRampToValueAtTime(volume * 0.1, now + index * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.3);
    });

    // Layer: Playful Popcorn Cascade (Bubble pops at offset times)
    const popOffsets = [0.05, 0.12, 0.20];
    const popFreqs = [700, 950, 1100];
    popOffsets.forEach((delay, idx) => {
      const oscPop = ctx.createOscillator();
      const gainPop = ctx.createGain();
      oscPop.type = "triangle";
      oscPop.frequency.setValueAtTime(popFreqs[idx] * 0.7, now + delay);
      oscPop.frequency.exponentialRampToValueAtTime(popFreqs[idx] * 1.3, now + delay + 0.03);

      gainPop.gain.setValueAtTime(0, now + delay);
      gainPop.gain.linearRampToValueAtTime(volume * 0.08, now + delay + 0.002);
      gainPop.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.03);

      oscPop.connect(gainPop);
      gainPop.connect(ctx.destination);
      oscPop.start(now + delay);
      oscPop.stop(now + delay + 0.04);
    });
  } catch (e) {
    console.error(e);
  }
}

/**
 * Satisfying Wind Rush / Rapid Intensification Sound
 * A warm, accelerating engine/turbine hum + rising frequency wind whoosh.
 */
export function playSndRapid(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.8);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(150, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.8);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.14, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    // Add a high-pitch whistle layer (wind vortex effect)
    const whistle = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistle.type = "sine";
    whistle.frequency.setValueAtTime(600, now);
    whistle.frequency.exponentialRampToValueAtTime(1800, now + 0.8);

    whistleGain.gain.setValueAtTime(0, now);
    whistleGain.gain.linearRampToValueAtTime(volume * 0.03, now + 0.3);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    whistle.connect(whistleGain);
    whistleGain.connect(ctx.destination);

    osc.start(now);
    whistle.start(now);
    osc.stop(now + 0.8);
    whistle.stop(now + 0.8);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Deep Satisfying Landfall Rumble
 * Uses a heavy low-frequency triangle shake and low-passed noise burst for a cinematic feel.
 */
export function playSndLand(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const noise = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.7);

    noise.type = "sawtooth";
    noise.frequency.setValueAtTime(40, now);
    noise.frequency.linearRampToValueAtTime(15, now + 0.7);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(75, now);

    gain.gain.setValueAtTime(volume * 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(lowpass);
    noise.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.7);
    noise.stop(now + 0.7);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Eye Wall Replacement Cycle (EWRC) Atmospheric Ring
 * Resonance sweeps of two phase-locked sine waves creating a beautiful acoustic ring.
 */
export function playSndEWRC(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.linearRampToValueAtTime(360, now + 0.3);
    osc1.frequency.linearRampToValueAtTime(280, now + 0.6);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(140, now);
    osc2.frequency.linearRampToValueAtTime(180, now + 0.3);
    osc2.frequency.linearRampToValueAtTime(140, now + 0.6);

    gain.gain.setValueAtTime(volume * 0.12, now);
    gain.gain.linearRampToValueAtTime(volume * 0.18, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Extratropical Transition (ET) Liquid Wave Sound
 * A smooth, descending organic wave representing the structural change.
 */
export function playSndET(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.6);

    gain.gain.setValueAtTime(volume * 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Dissipate / Dissolution Whisper
 * A fading, soothing sigh of wind with a gentle soft bubble burst.
 */
export function playSndDissipate(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Smooth white-noise simulation sigh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.9);

    gain.gain.setValueAtTime(volume * 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.9);

    // Layer: Tiny fading bubble burst
    const oscPop = ctx.createOscillator();
    const gainPop = ctx.createGain();
    oscPop.type = "sine";
    oscPop.frequency.setValueAtTime(600, now + 0.15);
    oscPop.frequency.exponentialRampToValueAtTime(300, now + 0.22);
    
    gainPop.gain.setValueAtTime(0, now + 0.15);
    gainPop.gain.linearRampToValueAtTime(volume * 0.05, now + 0.15 + 0.005);
    gainPop.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    oscPop.connect(gainPop);
    gainPop.connect(ctx.destination);
    oscPop.start(now + 0.15);
    oscPop.stop(now + 0.22);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Satisfying Mechanical Bezel Slider Tick
 * Perfect click for adjusting range sliders, feels high-end and tactile.
 */
export function playSndSliderTick(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.012);

    gainNode.gain.setValueAtTime(volume * 0.025, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.012);
  } catch (e) {
    // Fail silently to avoid interrupting slider interactions
  }
}

/**
 * Typhoon Spawn / Birth Sound
 * Warm wind blow combined with a soft ambient bell.
 */
export function playSndSpawn(volume = 0.5, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Layer 1: Warm wind puff
    const oscWind = ctx.createOscillator();
    const gainWind = ctx.createGain();
    oscWind.type = "triangle";
    oscWind.frequency.setValueAtTime(80, now);
    oscWind.frequency.linearRampToValueAtTime(160, now + 0.4);
    oscWind.frequency.linearRampToValueAtTime(60, now + 0.8);
    
    gainWind.gain.setValueAtTime(volume * 0.15, now);
    gainWind.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    // Layer 2: Satisfying ambient bell
    const oscBell = ctx.createOscillator();
    const gainBell = ctx.createGain();
    oscBell.type = "sine";
    oscBell.frequency.setValueAtTime(523.25, now); // C5
    oscBell.frequency.exponentialRampToValueAtTime(783.99, now + 0.55); // G5
    
    gainBell.gain.setValueAtTime(volume * 0.1, now);
    gainBell.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    oscWind.connect(gainWind);
    gainWind.connect(ctx.destination);
    
    oscBell.connect(gainBell);
    gainBell.connect(ctx.destination);
    
    oscWind.start(now);
    oscBell.start(now);
    
    oscWind.stop(now + 0.8);
    oscBell.stop(now + 0.8);
  } catch (e) {
    console.error(e);
  }
}
