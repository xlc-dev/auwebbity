import { formatDateForFilename } from "./dateUtils";

export const audioOperations = {
  async copy(audioBuffer: AudioBuffer, startTime: number, endTime: number): Promise<AudioBuffer> {
    const startSample = Math.floor(startTime * audioBuffer.sampleRate);
    const endSample = Math.floor(endTime * audioBuffer.sampleRate);
    const length = Math.max(1, endSample - startSample);

    const audioContext = new AudioContext();
    const newBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const oldData = audioBuffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      const copyLength = Math.min(length, endSample - startSample);
      for (let i = 0; i < copyLength; i++) {
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
    const audioContext = new AudioContext();

    const beforeLength = Math.max(1, startSample);
    const beforeBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      beforeLength,
      audioBuffer.sampleRate
    );

    const afterLength = Math.max(1, audioBuffer.length - endSample);
    const afterBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      afterLength,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const oldData = audioBuffer.getChannelData(channel);
      const beforeData = beforeBuffer.getChannelData(channel);
      const afterData = afterBuffer.getChannelData(channel);

      const actualBeforeLength = Math.min(beforeLength, startSample);
      for (let i = 0; i < actualBeforeLength; i++) {
        beforeData[i] = oldData[i] ?? 0;
      }

      const actualAfterLength = Math.min(afterLength, audioBuffer.length - endSample);
      for (let i = 0; i < actualAfterLength; i++) {
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
    const audioContext = new AudioContext();
    const newLength = originalBuffer.length + clipboardBuffer.length;

    const newBuffer = audioContext.createBuffer(
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

  async audioBufferToBlob(audioBuffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * numberOfChannels * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i] ?? 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  },

  async exportAudio(
    audioBuffer: AudioBuffer,
    format: "wav" | "mp3" | "ogg" = "wav",
    filename?: string
  ): Promise<void> {
    let blob: Blob;
    let extension: string;

    if (format === "wav") {
      blob = await this.audioBufferToBlob(audioBuffer);
      extension = "wav";
    } else {
      blob = await this.audioBufferToMP3OrOGG(audioBuffer, format);
      extension = format;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || `recording_${formatDateForFilename()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async audioBufferToMP3OrOGG(audioBuffer: AudioBuffer, format: "mp3" | "ogg"): Promise<Blob> {
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
      await ffmpeg.exec([
        "-i",
        "input.wav",
        "-codec:a",
        format === "mp3" ? "libmp3lame" : "libvorbis",
        "-qscale:a",
        "2",
        outputFile,
      ]);

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
