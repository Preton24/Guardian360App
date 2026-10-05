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
          this.webAudioElement.loop = true;
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
   * Play the emergency fall alarm sound
   */
  async play(): Promise<void> {
    if (this.isCurrentlyPlaying) {
      return;
    }
    this.isCurrentlyPlaying = true;
    console.log('[alarmSound] 🚨 Starting MixKit Emergency Alarm Playback...');

    // 1. WEB BROWSER PLAYBACK
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (!this.webAudioElement) {
          this.webAudioElement = new window.Audio(ALARM_SOUND_BASE64);
          this.webAudioElement.loop = true;
          this.webAudioElement.volume = 1.0;
        }

        this.webAudioElement.currentTime = 0;
        const playPromise = this.webAudioElement.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('[alarmSound] ✅ Web MixKit alarm playing successfully!');
            })
            .catch((err) => {
              console.warn('[alarmSound] HTML5 Audio autoplay restricted. Activating Web Audio synthesizer:', err);
              this.playWebSirenFallback();
            });
        }
        return;
      } catch (err) {
        console.warn('[alarmSound] Web HTML5 audio play failed, activating siren fallback:', err);
        this.playWebSirenFallback();
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
        this.modernAudioPlayer.loop = true;
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
            isLooping: true,
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
   * Web Audio API synthesized siren in case browser blocks HTML5 media tag autoplay
   */
  private playWebSirenFallback() {
    if (typeof window === 'undefined') return;
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
        } catch (_) {}
      }

      const osc = this.webAudioCtx.createOscillator();
      const gain = this.webAudioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, this.webAudioCtx.currentTime); // A5

      // Siren frequency modulation (LFO)
      const lfo = this.webAudioCtx.createOscillator();
      const lfoGain = this.webAudioCtx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(4, this.webAudioCtx.currentTime); // 4 Hz siren cycle
      lfoGain.gain.setValueAtTime(250, this.webAudioCtx.currentTime);

      lfo.connect(osc.frequency);
      gain.gain.setValueAtTime(0.4, this.webAudioCtx.currentTime);

      osc.connect(gain);
      gain.connect(this.webAudioCtx.destination);

      lfo.start();
      osc.start();
      this.webAudioOscillator = { osc, lfo };
      console.log('[alarmSound] 🚨 Web Audio Siren fallback running.');
    } catch (e) {
      console.warn('[alarmSound] Web siren synthesizer error:', e);
    }
  }

  /**
   * Stop alarm sound immediately
   */
  async stop(): Promise<void> {
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
        this.webAudioOscillator.osc?.stop();
        this.webAudioOscillator.lfo?.stop();
        this.webAudioOscillator.osc?.disconnect();
        this.webAudioOscillator.lfo?.disconnect();
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
