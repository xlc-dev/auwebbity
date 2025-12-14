import { audioOperations } from "./audioOperations";
import { mergeAudioBuffers } from "./audioBuffer";
import { createAudioBuffer } from "./audioContext";

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
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

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
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

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
    const silenceBuffer = createAudioBuffer(
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
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

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
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

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
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

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

  async reverb(
    buffer: AudioBuffer,
    roomSize: number,
    wetLevel: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0) {
      return buffer;
    }

    const clampedRoomSize = Math.max(0.1, Math.min(3, roomSize));
    const clampedWetLevel = Math.max(0, Math.min(1, wetLevel));

    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.reverbFull(buffer, clampedRoomSize, clampedWetLevel);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const reverbedRegion = await this.reverbFull(region, clampedRoomSize, clampedWetLevel);

    return mergeAudioBuffers(
      before,
      mergeAudioBuffers(reverbedRegion, after, buffer.numberOfChannels, buffer.sampleRate),
      buffer.numberOfChannels,
      buffer.sampleRate
    );
  },

  async reverbFull(buffer: AudioBuffer, roomSize: number, wetLevel: number): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0 || buffer.sampleRate <= 0) {
      return buffer;
    }

    const clampedRoomSize = Math.max(0.1, Math.min(3, roomSize));
    const clampedWetLevel = Math.max(0, Math.min(1, wetLevel));
    const dryLevel = 1.0 - clampedWetLevel;

    const reverbTime = Math.min(clampedRoomSize, 2.0);
    const impulseLength = Math.min(Math.floor(reverbTime * buffer.sampleRate), buffer.length * 2);

    if (impulseLength <= 0 || impulseLength > buffer.length * 2) {
      return buffer;
    }

    const totalLength = buffer.length + impulseLength;
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, totalLength, buffer.sampleRate);

    const delays = [
      Math.floor(0.03 * buffer.sampleRate),
      Math.floor(0.037 * buffer.sampleRate),
      Math.floor(0.041 * buffer.sampleRate),
      Math.floor(0.043 * buffer.sampleRate),
    ].map((d) => Math.min(d, buffer.length));

    const feedbacks = [0.3, 0.25, 0.2, 0.15];

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);
      const delayLines: number[][] = delays.map(() => new Array(impulseLength).fill(0));
      const delayIndices: number[] = delays.map(() => 0);

      for (let i = 0; i < buffer.length; i++) {
        const input = sourceData[i] ?? 0;
        let reverbSum = 0;

        for (let d = 0; d < delays.length; d++) {
          const delayLine = delayLines[d];
          const delayIndex = delayIndices[d];
          if (
            !delayLine ||
            delayIndex === undefined ||
            delayIndex < 0 ||
            delayIndex >= delayLine.length
          )
            continue;
          const idx = delayIndex;
          const line = delayLine!;
          const currentDelay = line[idx] ?? 0;
          const delayed = currentDelay;
          reverbSum += delayed * feedbacks[d]!;
          line[idx] = input + delayed * feedbacks[d]! * 0.5;
          delayIndices![d] = (idx + 1) % impulseLength;
        }

        destData[i] = input * dryLevel + reverbSum * clampedWetLevel;
      }

      for (let i = buffer.length; i < totalLength; i++) {
        let reverbSum = 0;
        for (let d = 0; d < delays.length; d++) {
          const delayLine = delayLines[d];
          const delayIndex = delayIndices[d];
          if (
            !delayLine ||
            delayIndex === undefined ||
            delayIndex < 0 ||
            delayIndex >= delayLine.length
          )
            continue;
          const idx = delayIndex;
          const line = delayLine!;
          const currentDelay = line[idx] ?? 0;
          const delayed = currentDelay;
          reverbSum += delayed * feedbacks[d]!;
          line[idx] = delayed * feedbacks[d]! * 0.5;
          delayIndices![d] = (idx + 1) % impulseLength;
        }
        destData[i] = reverbSum * clampedWetLevel;
      }

      if (totalLength > 0 && totalLength <= destData.length) {
        for (let i = 0; i < totalLength; i++) {
          const val = destData[i];
          if (val !== undefined) {
            destData[i] = Math.max(-1.0, Math.min(1.0, val));
          }
        }
      }
    }

    return newBuffer;
  },

  async delay(
    buffer: AudioBuffer,
    delayTime: number,
    feedback: number,
    wetLevel: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0) {
      return buffer;
    }

    const clampedDelayTime = Math.max(0.01, Math.min(2, delayTime));
    const clampedFeedback = Math.max(0, Math.min(0.99, feedback));
    const clampedWetLevel = Math.max(0, Math.min(1, wetLevel));

    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.delayFull(buffer, clampedDelayTime, clampedFeedback, clampedWetLevel);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const delayedRegion = await this.delayFull(
      region,
      clampedDelayTime,
      clampedFeedback,
      clampedWetLevel
    );

    return mergeAudioBuffers(
      before,
      mergeAudioBuffers(delayedRegion, after, buffer.numberOfChannels, buffer.sampleRate),
      buffer.numberOfChannels,
      buffer.sampleRate
    );
  },

  async delayFull(
    buffer: AudioBuffer,
    delayTime: number,
    feedback: number,
    wetLevel: number
  ): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0 || buffer.sampleRate <= 0) {
      return buffer;
    }

    const clampedDelayTime = Math.max(0.01, Math.min(2, delayTime));
    const clampedFeedback = Math.max(0, Math.min(0.95, feedback));
    const clampedWetLevel = Math.max(0, Math.min(1, wetLevel));
    const dryLevel = 1.0 - clampedWetLevel;

    const delaySamples = Math.min(
      Math.max(1, Math.floor(clampedDelayTime * buffer.sampleRate)),
      buffer.length
    );

    const maxTailSamples = Math.min(Math.floor(buffer.sampleRate * 2), buffer.length);
    const totalLength = Math.min(buffer.length + maxTailSamples, buffer.length * 3);

    if (totalLength <= 0 || delaySamples <= 0 || delaySamples > buffer.length) {
      return buffer;
    }

    const newBuffer = createAudioBuffer(buffer.numberOfChannels, totalLength, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);
      const delayLine: number[] = new Array(delaySamples).fill(0);
      let delayIndex = 0;

      for (let i = 0; i < buffer.length; i++) {
        const input = sourceData[i] ?? 0;
        const delayed = delayLine[delayIndex] ?? 0;

        destData[i] = input * dryLevel + delayed * clampedWetLevel;

        delayLine[delayIndex] = input + delayed * clampedFeedback;
        delayIndex = (delayIndex + 1) % delaySamples;
      }

      let decayFactor = 1.0;
      const decayRate = Math.pow(0.001, 1.0 / maxTailSamples);

      for (let i = buffer.length; i < totalLength; i++) {
        const delayed = delayLine[delayIndex] ?? 0;
        destData[i] = delayed * clampedWetLevel * decayFactor;

        delayLine[delayIndex] = delayed * clampedFeedback;
        delayIndex = (delayIndex + 1) % delaySamples;
        decayFactor *= decayRate;
      }

      if (totalLength > 0 && totalLength <= destData.length) {
        for (let i = 0; i < totalLength; i++) {
          const val = destData[i];
          if (val !== undefined) {
            destData[i] = Math.max(-1.0, Math.min(1.0, val));
          }
        }
      }
    }

    return newBuffer;
  },
};
