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

    const mergedAfter = await mergeAudioBuffers(
      normalizedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
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

    const mergedAfter = await mergeAudioBuffers(
      amplifiedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
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

    const mergedAfter = await mergeAudioBuffers(
      silenceBuffer,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
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

    const mergedAfter = await mergeAudioBuffers(
      reversedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
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

    const mergedAfter = await mergeAudioBuffers(
      fadedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
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

    const mergedAfter = await mergeAudioBuffers(
      fadedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
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

    const mergedAfter = await mergeAudioBuffers(
      reverbedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
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

    const mergedAfter = await mergeAudioBuffers(
      delayedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
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

  async noiseReduction(
    buffer: AudioBuffer,
    reductionAmount: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.noiseReductionFull(buffer, reductionAmount);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const reducedRegion = await this.noiseReductionFull(region, reductionAmount);

    const mergedAfter = await mergeAudioBuffers(
      reducedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
  },

  async noiseReductionFull(buffer: AudioBuffer, reductionAmount: number): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0) {
      return buffer;
    }

    const clampedReduction = Math.max(0, Math.min(1, reductionAmount));
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    const windowSize = Math.floor(buffer.sampleRate * 0.05);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);

      let noiseFloor = 0;
      let noiseSamples = 0;
      const threshold = 0.01;

      for (let i = 0; i < Math.min(windowSize * 10, sourceData.length); i++) {
        const abs = Math.abs(sourceData[i] ?? 0);
        if (abs < threshold) {
          noiseFloor += abs * abs;
          noiseSamples++;
        }
      }

      const avgNoisePower = noiseSamples > 0 ? noiseFloor / noiseSamples : 0.0001;
      const noiseThreshold = Math.sqrt(avgNoisePower) * 2;

      for (let i = 0; i < sourceData.length; i++) {
        const sample = sourceData[i] ?? 0;
        const absSample = Math.abs(sample);

        if (absSample < noiseThreshold) {
          const reductionFactor = 1 - clampedReduction * (1 - absSample / noiseThreshold);
          destData[i] = sample * reductionFactor;
        } else {
          const signalRatio = Math.min(1, (absSample - noiseThreshold) / (noiseThreshold * 2));
          const reductionFactor = 1 - clampedReduction * 0.1 * (1 - signalRatio);
          destData[i] = sample * reductionFactor;
        }
      }

      const smoothingWindow = Math.floor(buffer.sampleRate * 0.01);
      const smoothed = new Float32Array(destData.length);
      for (let i = 0; i < destData.length; i++) {
        let sum = 0;
        let count = 0;
        for (
          let j = Math.max(0, i - smoothingWindow);
          j < Math.min(destData.length, i + smoothingWindow);
          j++
        ) {
          sum += destData[j] ?? 0;
          count++;
        }
        smoothed[i] = count > 0 ? sum / count : (destData[i] ?? 0);
      }

      for (let i = 0; i < destData.length; i++) {
        const smoothedVal = smoothed[i] ?? 0;
        const currentVal = destData[i] ?? 0;
        destData[i] = smoothedVal * 0.7 + currentVal * 0.3;
        destData[i] = Math.max(-1.0, Math.min(1.0, destData[i] ?? 0));
      }
    }

    return newBuffer;
  },

  async changeSpeed(
    buffer: AudioBuffer,
    speedFactor: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration || speedFactor <= 0 || speedFactor > 4) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.changeSpeedFull(buffer, speedFactor);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const speedChangedRegion = await this.changeSpeedFull(region, speedFactor);

    const mergedAfter = await mergeAudioBuffers(
      speedChangedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
  },

  async changeSpeedFull(buffer: AudioBuffer, speedFactor: number): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0 || speedFactor <= 0 || speedFactor > 4) {
      return buffer;
    }

    const clampedSpeed = Math.max(0.25, Math.min(4, speedFactor));
    const newLength = Math.floor(buffer.length / clampedSpeed);
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);

      for (let i = 0; i < newLength; i++) {
        const sourceIndex = i * clampedSpeed;
        const index1 = Math.floor(sourceIndex);
        const index2 = Math.min(index1 + 1, sourceData.length - 1);
        const fraction = sourceIndex - index1;

        const sample1 = sourceData[index1] ?? 0;
        const sample2 = sourceData[index2] ?? 0;
        destData[i] = sample1 + (sample2 - sample1) * fraction;
      }
    }

    return newBuffer;
  },

  async changePitch(
    buffer: AudioBuffer,
    pitchFactor: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration || pitchFactor <= 0 || pitchFactor > 4) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.changePitchFull(buffer, pitchFactor);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const pitchChangedRegion = await this.changePitchFull(region, pitchFactor);

    const mergedAfter = await mergeAudioBuffers(
      pitchChangedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
  },

  async changePitchFull(buffer: AudioBuffer, pitchFactor: number): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0 || pitchFactor <= 0 || pitchFactor > 4) {
      return buffer;
    }

    const clampedPitch = Math.max(0.25, Math.min(4, pitchFactor));

    if (clampedPitch === 1.0) {
      return buffer;
    }

    const speedChanged = await this.changeSpeedFull(buffer, clampedPitch);

    const originalLength = buffer.length;
    const speedChangedLength = speedChanged.length;

    if (speedChangedLength <= 0) {
      return buffer;
    }

    const windowSize = Math.floor(buffer.sampleRate * 0.04);
    const hopSize = Math.floor(windowSize / 2);
    const stretchFactor = originalLength / speedChangedLength;

    const newBuffer = createAudioBuffer(buffer.numberOfChannels, originalLength, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = speedChanged.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);

      const window = new Float32Array(windowSize);
      for (let i = 0; i < windowSize; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
      }

      let outputPos = 0;
      let inputPos = 0;

      while (outputPos < originalLength && inputPos < speedChangedLength) {
        const windowed = new Float32Array(windowSize);
        for (let i = 0; i < windowSize; i++) {
          const sourceIndex = Math.floor(inputPos + i);
          if (sourceIndex < sourceData.length) {
            windowed[i] = (sourceData[sourceIndex] ?? 0) * (window[i] ?? 0);
          }
        }

        for (let i = 0; i < windowSize && outputPos + i < originalLength; i++) {
          const currentVal = destData[outputPos + i] ?? 0;
          destData[outputPos + i] = currentVal + (windowed[i] ?? 0);
        }

        inputPos += hopSize;
        outputPos += Math.floor(hopSize * stretchFactor);
      }

      const maxOverlap = Math.ceil(windowSize / hopSize);
      if (maxOverlap > 1) {
        for (let i = 0; i < originalLength; i++) {
          const currentVal = destData[i] ?? 0;
          destData[i] = currentVal / maxOverlap;
        }
      }

      for (let i = 0; i < originalLength; i++) {
        destData[i] = Math.max(-1.0, Math.min(1.0, destData[i] ?? 0));
      }
    }

    return newBuffer;
  },

  async compressor(
    buffer: AudioBuffer,
    threshold: number,
    ratio: number,
    attack: number,
    release: number,
    knee: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.compressorFull(buffer, threshold, ratio, attack, release, knee);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const compressedRegion = await this.compressorFull(
      region,
      threshold,
      ratio,
      attack,
      release,
      knee
    );

    const mergedAfter = await mergeAudioBuffers(
      compressedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
  },

  async compressorFull(
    buffer: AudioBuffer,
    threshold: number,
    ratio: number,
    attack: number,
    release: number,
    knee: number
  ): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0) {
      return buffer;
    }

    const clampedThreshold = Math.max(-60, Math.min(0, threshold));
    const clampedRatio = Math.max(1, Math.min(20, ratio));
    const clampedAttack = Math.max(0.0001, Math.min(1, attack));
    const clampedRelease = Math.max(0.01, Math.min(5, release));
    const clampedKnee = Math.max(0, Math.min(12, knee));

    const thresholdLinear = Math.pow(10, clampedThreshold / 20);
    const kneeStart = thresholdLinear * Math.pow(10, -clampedKnee / 20);
    const kneeEnd = thresholdLinear * Math.pow(10, clampedKnee / 20);

    const attackCoeff = Math.exp(-1 / (clampedAttack * buffer.sampleRate));
    const releaseCoeff = Math.exp(-1 / (clampedRelease * buffer.sampleRate));

    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);
      let envelope = 0;

      for (let i = 0; i < sourceData.length; i++) {
        const input = sourceData[i] ?? 0;
        const absInput = Math.abs(input);

        let targetGain = 1.0;

        if (absInput > kneeStart) {
          if (absInput < kneeEnd) {
            const overshoot = absInput - kneeStart;
            const compressedOvershoot = overshoot / clampedRatio;
            const compressedLevel = kneeStart + compressedOvershoot;
            targetGain = compressedLevel / absInput;
          } else {
            const overshoot = absInput - thresholdLinear;
            const compressedOvershoot = overshoot / clampedRatio;
            const compressedLevel = thresholdLinear + compressedOvershoot;
            targetGain = compressedLevel / absInput;
          }
        }

        if (targetGain < envelope) {
          envelope = targetGain + (envelope - targetGain) * attackCoeff;
        } else {
          envelope = targetGain + (envelope - targetGain) * releaseCoeff;
        }

        destData[i] = Math.max(-1.0, Math.min(1.0, input * envelope));
      }
    }

    return newBuffer;
  },

  async limiter(
    buffer: AudioBuffer,
    threshold: number,
    release: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.limiterFull(buffer, threshold, release);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const limitedRegion = await this.limiterFull(region, threshold, release);

    const mergedAfter = await mergeAudioBuffers(
      limitedRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
  },

  async limiterFull(buffer: AudioBuffer, threshold: number, release: number): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0) {
      return buffer;
    }

    const clampedThreshold = Math.max(-60, Math.min(0, threshold));
    const clampedRelease = Math.max(0.001, Math.min(1, release));

    const thresholdLinear = Math.pow(10, clampedThreshold / 20);
    const releaseCoeff = Math.exp(-1 / (clampedRelease * buffer.sampleRate));
    const attackCoeff = Math.exp(-1 / (0.0001 * buffer.sampleRate));

    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);
      let envelope = 1.0;

      for (let i = 0; i < sourceData.length; i++) {
        const input = sourceData[i] ?? 0;
        const absInput = Math.abs(input);

        let targetGain = 1.0;
        if (absInput > thresholdLinear) {
          targetGain = thresholdLinear / absInput;
        }

        if (targetGain < envelope) {
          envelope = targetGain + (envelope - targetGain) * attackCoeff;
        } else {
          envelope = targetGain + (envelope - targetGain) * releaseCoeff;
        }

        destData[i] = Math.max(-1.0, Math.min(1.0, input * envelope));
      }
    }

    return newBuffer;
  },

  async eq(
    buffer: AudioBuffer,
    frequency: number,
    gain: number,
    q: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.eqFull(buffer, frequency, gain, q);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const eqRegion = await this.eqFull(region, frequency, gain, q);

    const mergedAfter = await mergeAudioBuffers(
      eqRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
  },

  async eqFull(
    buffer: AudioBuffer,
    frequency: number,
    gain: number,
    q: number
  ): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0 || buffer.sampleRate <= 0) {
      return buffer;
    }

    const clampedFreq = Math.max(20, Math.min(buffer.sampleRate / 2 - 1, frequency));
    const clampedGain = Math.max(-20, Math.min(20, gain));
    const clampedQ = Math.max(0.1, Math.min(30, q));

    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const sampleRate = buffer.sampleRate;

    const w0 = (2 * Math.PI * clampedFreq) / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * clampedQ);
    const A = Math.pow(10, clampedGain / 40);

    const b0 = 1 + alpha * A;
    const b1 = -2 * cosW0;
    const b2 = 1 - alpha * A;
    const a0 = 1 + alpha / A;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha / A;

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);

      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;

      for (let i = 0; i < sourceData.length; i++) {
        const x0 = sourceData[i] ?? 0;
        const y0 =
          (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;

        destData[i] = Math.max(-1.0, Math.min(1.0, y0));

        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
      }
    }

    return newBuffer;
  },

  async highPassFilter(
    buffer: AudioBuffer,
    cutoffFrequency: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.highPassFilterFull(buffer, cutoffFrequency);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const filteredRegion = await this.highPassFilterFull(region, cutoffFrequency);

    const mergedAfter = await mergeAudioBuffers(
      filteredRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
  },

  async highPassFilterFull(buffer: AudioBuffer, cutoffFrequency: number): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0 || buffer.sampleRate <= 0) {
      return buffer;
    }

    const clampedFreq = Math.max(20, Math.min(buffer.sampleRate / 2 - 1, cutoffFrequency));
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const sampleRate = buffer.sampleRate;

    const w0 = (2 * Math.PI * clampedFreq) / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / 2;

    const b0 = (1 + cosW0) / 2;
    const b1 = -(1 + cosW0);
    const b2 = (1 + cosW0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha;

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);

      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;

      for (let i = 0; i < sourceData.length; i++) {
        const x0 = sourceData[i] ?? 0;
        const y0 =
          (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;

        destData[i] = Math.max(-1.0, Math.min(1.0, y0));

        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
      }
    }

    return newBuffer;
  },

  async lowPassFilter(
    buffer: AudioBuffer,
    cutoffFrequency: number,
    startTime?: number,
    endTime?: number
  ): Promise<AudioBuffer> {
    const duration = buffer.duration;
    const start = startTime ?? 0;
    const end = endTime ?? duration;

    if (start >= end || start < 0 || end > duration) {
      return buffer;
    }

    if (start === 0 && end >= duration) {
      return this.lowPassFilterFull(buffer, cutoffFrequency);
    }

    const { before, after } = await audioOperations.cut(buffer, start, end);
    const region = await audioOperations.copy(buffer, start, end);
    const filteredRegion = await this.lowPassFilterFull(region, cutoffFrequency);

    const mergedAfter = await mergeAudioBuffers(
      filteredRegion,
      after,
      buffer.numberOfChannels,
      buffer.sampleRate
    );
    return await mergeAudioBuffers(before, mergedAfter, buffer.numberOfChannels, buffer.sampleRate);
  },

  async lowPassFilterFull(buffer: AudioBuffer, cutoffFrequency: number): Promise<AudioBuffer> {
    if (!buffer || buffer.length === 0 || buffer.sampleRate <= 0) {
      return buffer;
    }

    const clampedFreq = Math.max(20, Math.min(buffer.sampleRate / 2 - 1, cutoffFrequency));
    const newBuffer = createAudioBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const sampleRate = buffer.sampleRate;

    const w0 = (2 * Math.PI * clampedFreq) / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / 2;

    const b0 = (1 - cosW0) / 2;
    const b1 = 1 - cosW0;
    const b2 = (1 - cosW0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha;

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = newBuffer.getChannelData(channel);

      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;

      for (let i = 0; i < sourceData.length; i++) {
        const x0 = sourceData[i] ?? 0;
        const y0 =
          (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;

        destData[i] = Math.max(-1.0, Math.min(1.0, y0));

        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
      }
    }

    return newBuffer;
  },
};
