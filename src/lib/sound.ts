// Sound utility using Web Audio API for browser notifications

class SoundService {
  private audioContext: AudioContext | null = null;
  private soundEnabled = true;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  // Play a beep sound
  private playBeep(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.soundEnabled) return;
    
    try {
      const ctx = this.getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gainNode.gain.value = 0.1;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
      }, duration);
    } catch (e) {
      console.error('Error playing sound:', e);
    }
  }

  // Play notification sound (new ticket received)
  playNewTicketSound() {
    // Double beep for new ticket
    this.playBeep(800, 150, 'sine');
    setTimeout(() => this.playBeep(1000, 150, 'sine'), 200);
  }

  // Play message sound (reply to ticket)
  playMessageSound() {
    this.playBeep(600, 100, 'sine');
  }

  // Play success sound
  playSuccessSound() {
    this.playBeep(523, 100, 'sine');
    setTimeout(() => this.playBeep(659, 100, 'sine'), 100);
    setTimeout(() => this.playBeep(784, 150, 'sine'), 200);
  }

  // Play error sound
  playErrorSound() {
    this.playBeep(200, 300, 'square');
  }

  // Play urgent ticket sound
  playUrgentSound() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playBeep(880, 150, 'sawtooth');
      }, i * 300);
    }
  }
}

export const soundService = new SoundService();
