import { audioOperations } from "./audioOperations";
import { mergeAudioBuffers } from "./audioBufferUtils";

export const audioEffects = {
  async normalize(buffer: AudioBuffer, startTime?: number, endTime?: number): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.normalizeFull(buffer);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const normalizedRegion = await this.normalizeFull(region);

    return mergeAudioBuffers(
      before,
      mergeAudioBuffers(normalizedRegion, after, buffer.numberOfChannels, buffer.sampleRate),
      buffer.numberOfChannels,
      buffer.sampleRate
    );
  },

  async normalizeFull(buffer: AudioBuffer): Promise<AudioBuffer> {
    const audioContext = new AudioContext();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i] ?? 0);
        if (abs > peak) {
          peak = abs;
        }
      }
    }

    if (peak === 0 || peak >= 1.0) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sourceData = buffer.getChannelData(channel);
        const destData = newBuffer.getChannelData(channel);
        destData.set(sourceData);
      }
      return newBuffer;
    }

    const factor = 1.0 / peak;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);
      for (let i = 0; i < sourceData.length; i++) {
        destData[i] = Math.max(-1.0, Math.min(1.0, (sourceData[i] ?? 0) * factor));
      }
    }

    return newBuffer;
  },

  async amplify(
    buffer: AudioBuffer,
    gain: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration || gain <= 0) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.amplifyFull(buffer, gain);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const amplifiedRegion = await this.amplifyFull(region, gain);

    return mergeAudioBuffers(
      before,
      mergeAudioBuffers(amplifiedRegion, after, buffer.numberOfChannels, buffer.sampleRate),
      buffer.numberOfChannels,
      buffer.sampleRate
    );
  },

  async amplifyFull(buffer: AudioBuffer, gain: number): Promise<AudioBuffer> {
    const audioContext = new AudioContext();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);
      for (let i = 0; i < sourceData.length; i++) {
        destData[i] = Math.max(-1.0, Math.min(1.0, (sourceData[i] ?? 0) * gain));
      }
    }

    return newBuffer;
  },

  async silence(buffer: AudioBuffer, startTime: number, endTime: number): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = Math.max(0, startTime);
    const end = Math.min(endTime, duration);

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const silenceLength = Math.floor((end - start) * buffer.sampleRate);
    const audioContext = new AudioContext();
    const silenceBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      Math.max(1, silenceLength),
      buffer.sampleRate
    );

    return mergeAudioBuffers(
      before,
      mergeAudioBuffers(silenceBuffer, after, buffer.numberOfChannels, buffer.sampleRate),
      buffer.numberOfChannels,
      buffer.sampleRate
    );
  },

  async reverse(buffer: AudioBuffer, startTime?: number, endTime?: number): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.reverseFull(buffer);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const reversedRegion = await this.reverseFull(region);

    return mergeAudioBuffers(
      before,
      mergeAudioBuffers(reversedRegion, after, buffer.numberOfChannels, buffer.sampleRate),
      buffer.numberOfChannels,
      buffer.sampleRate
    );
  },

  async reverseFull(buffer: AudioBuffer): Promise<AudioBuffer> {
    const audioContext = new AudioContext();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);
      for (let i = 0; i < sourceData.length; i++) {
        destData[i] = sourceData[sourceData.length - 1 - i] ?? 0;
      }
    }

    return newBuffer;
  },

  async fadeIn(
    buffer: AudioBuffer,
    fadeDuration?: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;
    const fadeTime = fadeDuration ?? Math.min(0.5, (end - start) / 2);

    if (start >= end || start < 0 || end > duration || fadeTime <= 0) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.fadeInFull(buffer, fadeTime);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const fadedRegion = await this.fadeInFull(region, fadeTime);

    return mergeAudioBuffers(
      before,
      mergeAudioBuffers(fadedRegion, after, buffer.numberOfChannels, buffer.sampleRate),
      buffer.numberOfChannels,
      buffer.sampleRate
    );
  },

  async fadeInFull(buffer: AudioBuffer, fadeDuration: number): Promise<AudioBuffer> {
    const audioContext = new AudioContext();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const fadeSamples = Math.floor(fadeDuration * buffer.sampleRate);
    const fadeLength = Math.min(fadeSamples, buffer.length);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        if (i < fadeLength) {
          const fadeFactor = i / fadeLength;
          destData[i] = (sourceData[i] ?? 0) * fadeFactor;
        } else {
          destData[i] = sourceData[i] ?? 0;
        }
      }
    }

    return newBuffer;
  },

  async fadeOut(
    buffer: AudioBuffer,
    fadeDuration?: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;
    const fadeTime = fadeDuration ?? Math.min(0.5, (end - start) / 2);

    if (start >= end || start < 0 || end > duration || fadeTime <= 0) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.fadeOutFull(buffer, fadeTime);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const fadedRegion = await this.fadeOutFull(region, fadeTime);

    return mergeAudioBuffers(
      before,
      mergeAudioBuffers(fadedRegion, after, buffer.numberOfChannels, buffer.sampleRate),
      buffer.numberOfChannels,
      buffer.sampleRate
    );
  },

  async fadeOutFull(buffer: AudioBuffer, fadeDuration: number): Promise<AudioBuffer> {
    const audioContext = new AudioContext();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const fadeSamples = Math.floor(fadeDuration * buffer.sampleRate);
    const fadeLength = Math.min(fadeSamples, buffer.length);
    const fadeStart = buffer.length - fadeLength;

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        if (i >= fadeStart) {
          const fadeFactor = (buffer.length - i) / fadeLength;
          destData[i] = (sourceData[i] ?? 0) * fadeFactor;
        } else {
          destData[i] = sourceData[i] ?? 0;
        }
      }
    }

    return newBuffer;
  },
};
