import { createAudioBuffer } from "./audioContext";

export const audioOperations = {
  async copy(audioBuffer: AudioBuffer, startTime: number, endTime: number): Promise<AudioBuffer> {
    const startSample = Math.floor(startTime * audioBuffer.sampleRate);
    const endSample = Math.floor(endTime * audioBuffer.sampleRate);
    const length = Math.max(1, endSample - startSample);

    const newBuffer = createAudioBuffer(
      audioBuffer.numberOfChannels,
      length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const oldData = audioBuffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        newData[i] = oldData[startSample + i] ?? 0;
      }
    }

    return newBuffer;
  },

  async cut(
    audioBuffer: AudioBuffer,
    startTime: number,
    endTime: number
  ): Promise<{ before: AudioBuffer; after: AudioBuffer }> {
    const startSample = Math.floor(startTime * audioBuffer.sampleRate);
    const endSample = Math.floor(endTime * audioBuffer.sampleRate);

    const beforeLength = Math.max(1, startSample);
    const beforeBuffer = createAudioBuffer(
      audioBuffer.numberOfChannels,
      beforeLength,
      audioBuffer.sampleRate
    );

    const afterLength = Math.max(1, audioBuffer.length - endSample);
    const afterBuffer = createAudioBuffer(
      audioBuffer.numberOfChannels,
      afterLength,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const oldData = audioBuffer.getChannelData(channel);
      const beforeData = beforeBuffer.getChannelData(channel);
      const afterData = afterBuffer.getChannelData(channel);

      for (let i = 0; i < startSample; i++) {
        beforeData[i] = oldData[i] ?? 0;
      }

      for (let i = 0; i < audioBuffer.length - endSample; i++) {
        afterData[i] = oldData[endSample + i] ?? 0;
      }
    }

    return { before: beforeBuffer, after: afterBuffer };
  },

  async paste(
    originalBuffer: AudioBuffer,
    clipboardBuffer: AudioBuffer,
    insertTime: number
  ): Promise<AudioBuffer> {
    const insertSample = Math.floor(insertTime * originalBuffer.sampleRate);
    const newLength = originalBuffer.length + clipboardBuffer.length;

    const newBuffer = createAudioBuffer(
      Math.max(originalBuffer.numberOfChannels, clipboardBuffer.numberOfChannels),
      newLength,
      originalBuffer.sampleRate
    );

    for (let channel = 0; channel < newBuffer.numberOfChannels; channel++) {
      const newData = newBuffer.getChannelData(channel);
      const originalData =
        channel < originalBuffer.numberOfChannels
          ? originalBuffer.getChannelData(channel)
          : new Float32Array(originalBuffer.length);
      const clipboardData =
        channel < clipboardBuffer.numberOfChannels
          ? clipboardBuffer.getChannelData(channel)
          : new Float32Array(clipboardBuffer.length);

      for (let i = 0; i < insertSample; i++) {
        newData[i] = originalData[i] ?? 0;
      }

      for (let i = 0; i < clipboardBuffer.length; i++) {
        newData[insertSample + i] = clipboardData[i] ?? 0;
      }

      for (let i = 0; i < originalBuffer.length - insertSample; i++) {
        newData[insertSample + clipboardBuffer.length + i] = originalData[insertSample + i] ?? 0;
      }
    }

    return newBuffer;
  },

  async audioBufferToBlob(audioBuffer: AudioBuffer, bitDepth: number = 16): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bytesPerSample = Math.max(2, Math.floor(bitDepth / 8));

    const buffer = new ArrayBuffer(44 + length * numberOfChannels * bytesPerSample);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * numberOfChannels * bytesPerSample, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
    view.setUint16(32, numberOfChannels * bytesPerSample, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, length * numberOfChannels * bytesPerSample, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i] ?? 0));
        if (bitDepth === 16) {
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
          offset += 2;
        } else if (bitDepth === 24) {
          const intSample = Math.floor(sample * 0x7fffff);
          view.setUint8(offset, intSample & 0xff);
          view.setUint8(offset + 1, (intSample >> 8) & 0xff);
          view.setUint8(offset + 2, (intSample >> 16) & 0xff);
          offset += 3;
        } else if (bitDepth === 32) {
          view.setInt32(offset, sample < 0 ? sample * 0x80000000 : sample * 0x7fffffff, true);
          offset += 4;
        } else {
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
          offset += 2;
        }
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  },

  async exportAudio(
    audioBuffer: AudioBuffer,
    format: "wav" | "mp3" | "ogg" = "wav",
    filename?: string,
    quality?: string
  ): Promise<void> {
    const blob =
      format === "wav"
        ? await this.audioBufferToBlob(audioBuffer, quality ? parseInt(quality, 10) : 16)
        : await this.audioBufferToMP3OrOGG(audioBuffer, format, quality);

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      filename ||
      `recording_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async split(
    audioBuffer: AudioBuffer,
    splitTime: number
  ): Promise<{ left: AudioBuffer; right: AudioBuffer }> {
    const splitSample = Math.floor(splitTime * audioBuffer.sampleRate);

    const leftLength = Math.max(1, splitSample);
    const rightLength = Math.max(1, audioBuffer.length - splitSample);

    const leftBuffer = createAudioBuffer(
      audioBuffer.numberOfChannels,
      leftLength,
      audioBuffer.sampleRate
    );

    const rightBuffer = createAudioBuffer(
      audioBuffer.numberOfChannels,
      rightLength,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const oldData = audioBuffer.getChannelData(channel);
      const leftData = leftBuffer.getChannelData(channel);
      const rightData = rightBuffer.getChannelData(channel);

      for (let i = 0; i < leftLength; i++) {
        leftData[i] = oldData[i] ?? 0;
      }

      for (let i = 0; i < rightLength; i++) {
        rightData[i] = oldData[splitSample + i] ?? 0;
      }
    }

    return { left: leftBuffer, right: rightBuffer };
  },

  async audioBufferToMP3OrOGG(
    audioBuffer: AudioBuffer,
    format: "mp3" | "ogg",
    quality?: string
  ): Promise<Blob> {
    const wavBlob = await this.audioBufferToBlob(audioBuffer);
    const wavArrayBuffer = await wavBlob.arrayBuffer();

    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });

      await ffmpeg.writeFile("input.wav", new Uint8Array(wavArrayBuffer));

      const outputFile = `output.${format}`;
      const args = ["-i", "input.wav", "-codec:a"];

      if (format === "mp3") {
        args.push("libmp3lame");
        const bitrate = quality || "192";
        args.push("-b:a", `${bitrate}k`);
      } else {
        args.push("libvorbis");
        const qualityValue = quality || "5";
        args.push("-qscale:a", qualityValue);
      }

      args.push(outputFile);

      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile(outputFile);

      await ffmpeg.deleteFile("input.wav");
      await ffmpeg.deleteFile(outputFile);

      const blobData =
        typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
      return new Blob([blobData], {
        type: format === "mp3" ? "audio/mpeg" : "audio/ogg",
      });
    } catch (error) {
      console.error("FFmpeg conversion error:", error);
      throw new Error(
        `Failed to convert audio to ${format.toUpperCase()}. ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
