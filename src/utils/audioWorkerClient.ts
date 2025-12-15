import { createAudioBuffer } from "./audioContext";
import type { AudioWorkerMessage, AudioWorkerResponse } from "../workers/audioWorker";

let worker: Worker | null = null;
let messageIdCounter = 0;
const pendingMessages = new Map<
  string,
  {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/audioWorker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e: MessageEvent<AudioWorkerResponse>) => {
      const { id, success, data, error } = e.data;
      const pending = pendingMessages.get(id);
      if (pending) {
        pendingMessages.delete(id);
        if (success) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error || "Unknown error"));
        }
      }
    };

    worker.onerror = (error) => {
      console.error("Audio worker error:", error);
      // Reject all pending messages
      for (const [id, pending] of pendingMessages.entries()) {
        pendingMessages.delete(id);
        pending.reject(new Error("Worker error"));
      }
    };
  }
  return worker;
}

function serializeAudioBuffer(buffer: AudioBuffer): {
  channelData: Float32Array[];
  sampleRate: number;
  numberOfChannels: number;
  length: number;
} {
  const channelData: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }
  return {
    channelData,
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length,
  };
}

function deserializeAudioBuffer(serialized: {
  channelData: Float32Array[];
  sampleRate: number;
  numberOfChannels: number;
  length: number;
}): AudioBuffer {
  const { channelData, sampleRate, numberOfChannels, length } = serialized;
  const buffer = createAudioBuffer(numberOfChannels, length, sampleRate);

  for (let i = 0; i < numberOfChannels; i++) {
    const destData = buffer.getChannelData(i);
    const sourceData = channelData[i];
    if (sourceData) {
      destData.set(sourceData);
    }
  }

  return buffer;
}

function sendMessage<T>(type: AudioWorkerMessage["type"], data: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `msg-${++messageIdCounter}`;
    const worker = getWorker();

    pendingMessages.set(id, { resolve, reject });

    const message: AudioWorkerMessage = {
      id,
      type,
      data,
    };

    // Transfer ownership of ArrayBuffers for better performance
    const transferables: Transferable[] = [];
    if (data.buffer?.channelData) {
      data.buffer.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
    }
    if (data.originalBuffer?.channelData) {
      data.originalBuffer.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
    }
    if (data.clipboardBuffer?.channelData) {
      data.clipboardBuffer.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
    }
    if (data.beforeBuffer?.channelData) {
      data.beforeBuffer.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
    }
    if (data.afterBuffer?.channelData) {
      data.afterBuffer.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
    }

    worker.postMessage(message, transferables);

    setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id);
        reject(new Error("Operation timeout"));
      }
    }, 30000);
  });
}

export const audioWorkerClient = {
  async copy(audioBuffer: AudioBuffer, startTime: number, endTime: number): Promise<AudioBuffer> {
    const serialized = serializeAudioBuffer(audioBuffer);
    const result = await sendMessage<ReturnType<typeof serializeAudioBuffer>>("copy", {
      buffer: serialized,
      startTime,
      endTime,
    });
    return deserializeAudioBuffer(result);
  },

  async cut(
    audioBuffer: AudioBuffer,
    startTime: number,
    endTime: number
  ): Promise<{ before: AudioBuffer; after: AudioBuffer }> {
    const serialized = serializeAudioBuffer(audioBuffer);
    const result = await sendMessage<{
      before: ReturnType<typeof serializeAudioBuffer>;
      after: ReturnType<typeof serializeAudioBuffer>;
    }>("cut", {
      buffer: serialized,
      startTime,
      endTime,
    });
    return {
      before: deserializeAudioBuffer(result.before),
      after: deserializeAudioBuffer(result.after),
    };
  },

  async paste(
    originalBuffer: AudioBuffer,
    clipboardBuffer: AudioBuffer,
    insertTime: number
  ): Promise<AudioBuffer> {
    const originalSerialized = serializeAudioBuffer(originalBuffer);
    const clipboardSerialized = serializeAudioBuffer(clipboardBuffer);
    const result = await sendMessage<ReturnType<typeof serializeAudioBuffer>>("paste", {
      originalBuffer: originalSerialized,
      clipboardBuffer: clipboardSerialized,
      insertTime,
    });
    return deserializeAudioBuffer(result);
  },

  async split(
    audioBuffer: AudioBuffer,
    splitTime: number
  ): Promise<{ left: AudioBuffer; right: AudioBuffer }> {
    const serialized = serializeAudioBuffer(audioBuffer);
    const result = await sendMessage<{
      left: ReturnType<typeof serializeAudioBuffer>;
      right: ReturnType<typeof serializeAudioBuffer>;
    }>("split", {
      buffer: serialized,
      splitTime,
    });
    return {
      left: deserializeAudioBuffer(result.left),
      right: deserializeAudioBuffer(result.right),
    };
  },

  async merge(
    before: AudioBuffer,
    after: AudioBuffer,
    numberOfChannels: number,
    sampleRate: number
  ): Promise<AudioBuffer> {
    const beforeSerialized = serializeAudioBuffer(before);
    const afterSerialized = serializeAudioBuffer(after);
    const result = await sendMessage<ReturnType<typeof serializeAudioBuffer>>("merge", {
      beforeBuffer: beforeSerialized,
      afterBuffer: afterSerialized,
      numberOfChannels,
      sampleRate,
    });
    return deserializeAudioBuffer(result);
  },

  terminate(): void {
    if (worker) {
      worker.terminate();
      worker = null;
      pendingMessages.clear();
    }
  },
};
