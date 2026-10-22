import { Platform } from 'react-native';
import { ALARM_SOUND_BASE64 } from '../assets/sounds/alarmBase64';

// Safely obtain audio module without throwing uncaught native module errors
let ExpoAudioModern: any = null;
let ExpoAVAudio: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExpoAudioModern = require('expo-audio');
} catch (_) {}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const av = require('expo-av');
  if (av && av.Audio) {
    ExpoAVAudio = av.Audio;
  }
} catch (_) {}

class AlarmSoundService {
  private modernAudioPlayer: any = null;
  private avSoundInstance: any = null;
  private webAudioElement: HTMLAudioElement | null = null;
  private webAudioOscillator: any = null;
  private webAudioCtx: any = null;
  private isCurrentlyPlaying: boolean = false;
  private isUnlocked: boolean = false;
  private autoStopTimer: any = null;

  constructor() {
    this.setupWebAudioUnlock();
  }

  /**
   * On Web browsers, unlock AudioContext and pre-warm audio element on first user interaction
   */
  private setupWebAudioUnlock() {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const unlock = () => {
      if (this.isUnlocked) return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!this.webAudioCtx || this.webAudioCtx.state === 'closed') {
            this.webAudioCtx = new AudioCtx();
          }
          if (this.webAudioCtx.state === 'suspended') {
            this.webAudioCtx.resume();
          }
        }

        if (!this.webAudioElement) {
          this.webAudioElement = new window.Audio(ALARM_SOUND_BASE64);
          this.webAudioElement.loop = false;
          this.webAudioElement.volume = 1.0;
          this.webAudioElement.load();
        }

        this.isUnlocked = true;
      } catch (_) {}

      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('click', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
  }

  /**
   * Play the emergency fall alarm sound with guaranteed auto-stop after 3.5 seconds
   */
  async play(autoStopMs: number = 3500): Promise<void> {
    // Reset any prior auto-stop timer
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }

    // Schedule automatic termination so siren never plays endlessly
    this.autoStopTimer = setTimeout(() => {
      console.log('[alarmSound] ⏱️ Auto-stopping emergency alarm sound after 3.5 seconds...');
      this.stop();
    }, autoStopMs);

    if (this.isCurrentlyPlaying) {
      return;
    }
    this.isCurrentlyPlaying = true;
    console.log('[alarmSound] 🚨 Starting Emergency Alarm Playback (will auto-stop in 3.5s)...');

    // 1. WEB BROWSER PLAYBACK
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (!this.webAudioElement) {
          this.webAudioElement = new window.Audio(ALARM_SOUND_BASE64);
          this.webAudioElement.loop = false; // Do NOT loop indefinitely
          this.webAudioElement.volume = 1.0;
        } else {
          this.webAudioElement.loop = false;
        }

        this.webAudioElement.currentTime = 0;
        const playPromise = this.webAudioElement.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('[alarmSound] ✅ Web MixKit alarm playing successfully!');
            })
            .catch((err) => {
              // Ignore normal aborts caused by stop() or pause()
              if (err?.name === 'AbortError' || !this.isCurrentlyPlaying) {
                return;
              }
              console.warn('[alarmSound] HTML5 Audio autoplay restricted. Activating Web Audio synthesizer:', err);
              if (this.isCurrentlyPlaying) {
                this.playWebSirenFallback(autoStopMs);
              }
            });
        }
        return;
      } catch (err) {
        console.warn('[alarmSound] Web HTML5 audio play failed, activating siren fallback:', err);
        if (this.isCurrentlyPlaying) {
          this.playWebSirenFallback(autoStopMs);
        }
        return;
      }
    }

    // 2. MODERN EXPO AUDIO (expo-audio)
    if (ExpoAudioModern && typeof ExpoAudioModern.createAudioPlayer === 'function') {
      try {
        if (this.modernAudioPlayer) {
          try {
            this.modernAudioPlayer.pause();
            this.modernAudioPlayer.remove?.();
          } catch (_) {}
          this.modernAudioPlayer = null;
        }

        this.modernAudioPlayer = ExpoAudioModern.createAudioPlayer({ uri: ALARM_SOUND_BASE64 });
        this.modernAudioPlayer.loop = false; // Do NOT loop indefinitely
        this.modernAudioPlayer.volume = 1.0;
        this.modernAudioPlayer.play();
        console.log('[alarmSound] ✅ expo-audio MixKit alarm playing!');
        return;
      } catch (err) {
        console.warn('[alarmSound] expo-audio player playback failed:', err);
      }
    }

    // 3. LEGACY EXPO AV (expo-av)
    if (ExpoAVAudio) {
      try {
        try {
          await ExpoAVAudio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        } catch (_) {}

        if (this.avSoundInstance) {
          try {
            await this.avSoundInstance.stopAsync();
            await this.avSoundInstance.unloadAsync();
          } catch (_) {}
          this.avSoundInstance = null;
        }

        const { sound } = await ExpoAVAudio.Sound.createAsync(
          { uri: ALARM_SOUND_BASE64 },
          {
            shouldPlay: true,
            isLooping: false, // Do NOT loop indefinitely
            volume: 1.0,
          }
        );

        this.avSoundInstance = sound;
        await sound.playAsync();
        console.log('[alarmSound] ✅ expo-av MixKit alarm playing!');
        return;
      } catch (err) {
        console.warn('[alarmSound] expo-av playback error:', err);
      }
    }
  }

  /**
   * Web Audio API synthesized siren in case browser blocks HTML5 media tag autoplay.
   * Auto-stops sound and disconnects nodes within autoStopMs.
   */
  private playWebSirenFallback(autoStopMs: number = 3500) {
    if (typeof window === 'undefined' || !this.isCurrentlyPlaying) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.webAudioCtx || this.webAudioCtx.state === 'closed') {
        this.webAudioCtx = new AudioCtx();
      }

      if (this.webAudioCtx.state === 'suspended') {
        this.webAudioCtx.resume();
      }

      if (this.webAudioOscillator) {
        try {
          this.webAudioOscillator.osc?.stop();
          this.webAudioOscillator.osc?.disconnect();
          this.webAudioOscillator.lfo?.stop();
          this.webAudioOscillator.lfo?.disconnect();
          this.webAudioOscillator.gain?.disconnect();
        } catch (_) {}
      }

      const now = this.webAudioCtx.currentTime;
      const stopTime = now + (autoStopMs / 1000);

      const osc = this.webAudioCtx.createOscillator();
      const gain = this.webAudioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now); // A5

      // Siren frequency modulation (LFO)
      const lfo = this.webAudioCtx.createOscillator();
      const lfoGain = this.webAudioCtx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(4, now); // 4 Hz siren cycle
      lfoGain.gain.setValueAtTime(250, now);

      lfo.connect(osc.frequency);
      gain.gain.setValueAtTime(0.35, now);
      // Smooth fade out right before auto-stop
      gain.gain.setValueAtTime(0.35, Math.max(now, stopTime - 0.2));
      gain.gain.linearRampToValueAtTime(0.001, stopTime);

      osc.connect(gain);
      gain.connect(this.webAudioCtx.destination);

      lfo.start(now);
      osc.start(now);

      // Web Audio hard scheduled stop
      lfo.stop(stopTime);
      osc.stop(stopTime);

      this.webAudioOscillator = { osc, lfo, gain };
      console.log(`[alarmSound] 🚨 Web Audio Siren fallback active (auto-stopping in ${autoStopMs}ms).`);
    } catch (e) {
      console.warn('[alarmSound] Web siren synthesizer error:', e);
    }
  }

  /**
   * Stop alarm sound immediately and clean up all resources
   */
  async stop(): Promise<void> {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
    this.isCurrentlyPlaying = false;
    console.log('[alarmSound] 🛑 Stopping emergency alarm sound...');

    // Stop Web Audio element
    if (this.webAudioElement) {
      try {
        this.webAudioElement.pause();
        this.webAudioElement.currentTime = 0;
      } catch (_) {}
    }

    // Stop Web Siren fallback
    if (this.webAudioOscillator) {
      try {
        if (this.webAudioOscillator.gain && this.webAudioCtx) {
          this.webAudioOscillator.gain.gain.setValueAtTime(0.0001, this.webAudioCtx.currentTime);
        }
        this.webAudioOscillator.osc?.stop();
        this.webAudioOscillator.lfo?.stop();
        this.webAudioOscillator.osc?.disconnect();
        this.webAudioOscillator.lfo?.disconnect();
        this.webAudioOscillator.gain?.disconnect();
      } catch (_) {}
      this.webAudioOscillator = null;
    }

    // Stop expo-audio modern player
    if (this.modernAudioPlayer) {
      try {
        this.modernAudioPlayer.pause();
        this.modernAudioPlayer.remove?.();
      } catch (_) {}
      this.modernAudioPlayer = null;
    }

    // Stop expo-av Sound instance
    if (this.avSoundInstance) {
      try {
        await this.avSoundInstance.stopAsync();
        await this.avSoundInstance.unloadAsync();
      } catch (_) {}
      this.avSoundInstance = null;
    }
  }

  isPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }
}

export const alarmSound = new AlarmSoundService();
export default alarmSound;
