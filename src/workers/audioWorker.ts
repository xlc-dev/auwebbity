export interface AudioWorkerMessage {
  id: string;
  type: "copy" | "cut" | "paste" | "split" | "merge";
  data: any;
}

export interface AudioWorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
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

function copy(
  serializedBuffer: ReturnType<typeof serializeAudioBuffer>,
  startTime: number,
  endTime: number
): ReturnType<typeof serializeAudioBuffer> {
  const { channelData, sampleRate, numberOfChannels } = serializedBuffer;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const newLength = Math.max(1, endSample - startSample);

  const newChannelData: Float32Array[] = [];
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const newData = new Float32Array(newLength);
    const sourceData = channelData[channel];
    if (sourceData) {
      for (let i = 0; i < newLength; i++) {
        newData[i] = sourceData[startSample + i] ?? 0;
      }
    }
    newChannelData.push(newData);
  }

  return {
    channelData: newChannelData,
    sampleRate,
    numberOfChannels,
    length: newLength,
  };
}

function cut(
  serializedBuffer: ReturnType<typeof serializeAudioBuffer>,
  startTime: number,
  endTime: number
): {
  before: ReturnType<typeof serializeAudioBuffer>;
  after: ReturnType<typeof serializeAudioBuffer>;
} {
  const { channelData, sampleRate, numberOfChannels, length } = serializedBuffer;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);

  const beforeLength = Math.max(1, startSample);
  const afterLength = Math.max(1, length - endSample);

  const beforeChannelData: Float32Array[] = [];
  const afterChannelData: Float32Array[] = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const sourceData = channelData[channel];
    if (!sourceData) {
      beforeChannelData.push(new Float32Array(beforeLength));
      afterChannelData.push(new Float32Array(afterLength));
      continue;
    }

    const beforeData = new Float32Array(beforeLength);
    for (let i = 0; i < startSample; i++) {
      beforeData[i] = sourceData[i] ?? 0;
    }
    beforeChannelData.push(beforeData);

    const afterData = new Float32Array(afterLength);
    for (let i = 0; i < length - endSample; i++) {
      afterData[i] = sourceData[endSample + i] ?? 0;
    }
    afterChannelData.push(afterData);
  }

  return {
    before: {
      channelData: beforeChannelData,
      sampleRate,
      numberOfChannels,
      length: beforeLength,
    },
    after: {
      channelData: afterChannelData,
      sampleRate,
      numberOfChannels,
      length: afterLength,
    },
  };
}

function paste(
  originalSerialized: ReturnType<typeof serializeAudioBuffer>,
  clipboardSerialized: ReturnType<typeof serializeAudioBuffer>,
  insertTime: number
): ReturnType<typeof serializeAudioBuffer> {
  const {
    channelData: origData,
    sampleRate,
    numberOfChannels: origChannels,
    length: origLength,
  } = originalSerialized;
  const {
    channelData: clipData,
    numberOfChannels: clipChannels,
    length: clipLength,
  } = clipboardSerialized;

  const insertSample = Math.floor(insertTime * sampleRate);
  const newLength = origLength + clipLength;
  const maxChannels = Math.max(origChannels, clipChannels);

  const newChannelData: Float32Array[] = [];

  for (let channel = 0; channel < maxChannels; channel++) {
    const newData = new Float32Array(newLength);
    const origChannelData =
      channel < origChannels && origData[channel]
        ? origData[channel]!
        : new Float32Array(origLength);
    const clipChannelData =
      channel < clipChannels && clipData[channel]
        ? clipData[channel]!
        : new Float32Array(clipLength);

    for (let i = 0; i < insertSample; i++) {
      newData[i] = origChannelData[i] ?? 0;
    }

    for (let i = 0; i < clipLength; i++) {
      newData[insertSample + i] = clipChannelData[i] ?? 0;
    }

    for (let i = 0; i < origLength - insertSample; i++) {
      newData[insertSample + clipLength + i] = origChannelData[insertSample + i] ?? 0;
    }

    newChannelData.push(newData);
  }

  return {
    channelData: newChannelData,
    sampleRate,
    numberOfChannels: maxChannels,
    length: newLength,
  };
}

function split(
  serializedBuffer: ReturnType<typeof serializeAudioBuffer>,
  splitTime: number
): {
  left: ReturnType<typeof serializeAudioBuffer>;
  right: ReturnType<typeof serializeAudioBuffer>;
} {
  const { channelData, sampleRate, numberOfChannels, length } = serializedBuffer;
  const splitSample = Math.floor(splitTime * sampleRate);

  const leftLength = Math.max(1, splitSample);
  const rightLength = Math.max(1, length - splitSample);

  const leftChannelData: Float32Array[] = [];
  const rightChannelData: Float32Array[] = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const sourceData = channelData[channel];
    if (!sourceData) {
      leftChannelData.push(new Float32Array(leftLength));
      rightChannelData.push(new Float32Array(rightLength));
      continue;
    }

    const leftData = new Float32Array(leftLength);
    for (let i = 0; i < leftLength; i++) {
      leftData[i] = sourceData[i] ?? 0;
    }
    leftChannelData.push(leftData);

    const rightData = new Float32Array(rightLength);
    for (let i = 0; i < rightLength; i++) {
      rightData[i] = sourceData[splitSample + i] ?? 0;
    }
    rightChannelData.push(rightData);
  }

  return {
    left: {
      channelData: leftChannelData,
      sampleRate,
      numberOfChannels,
      length: leftLength,
    },
    right: {
      channelData: rightChannelData,
      sampleRate,
      numberOfChannels,
      length: rightLength,
    },
  };
}

function merge(
  beforeSerialized: ReturnType<typeof serializeAudioBuffer>,
  afterSerialized: ReturnType<typeof serializeAudioBuffer>,
  numberOfChannels: number,
  sampleRate: number
): ReturnType<typeof serializeAudioBuffer> {
  const { channelData: beforeData, length: beforeLength } = beforeSerialized;
  const { channelData: afterData, length: afterLength } = afterSerialized;
  const newLength = Math.max(1, beforeLength + afterLength);

  const newChannelData: Float32Array[] = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const newData = new Float32Array(newLength);
    const beforeChannelData =
      channel < beforeData.length && beforeData[channel]
        ? beforeData[channel]!
        : new Float32Array(beforeLength);
    const afterChannelData =
      channel < afterData.length && afterData[channel]
        ? afterData[channel]!
        : new Float32Array(afterLength);

    for (let i = 0; i < beforeLength; i++) {
      newData[i] = beforeChannelData[i] ?? 0;
    }
    for (let i = 0; i < afterLength; i++) {
      newData[beforeLength + i] = afterChannelData[i] ?? 0;
    }

    newChannelData.push(newData);
  }

  return {
    channelData: newChannelData,
    sampleRate,
    numberOfChannels,
    length: newLength,
  };
}

self.onmessage = (e: MessageEvent<AudioWorkerMessage>) => {
  const { id, type, data } = e.data;

  try {
    let result: any;

    switch (type) {
      case "copy":
        result = copy(data.buffer, data.startTime, data.endTime);
        break;
      case "cut":
        result = cut(data.buffer, data.startTime, data.endTime);
        break;
      case "paste":
        result = paste(data.originalBuffer, data.clipboardBuffer, data.insertTime);
        break;
      case "split":
        result = split(data.buffer, data.splitTime);
        break;
      case "merge":
        result = merge(data.beforeBuffer, data.afterBuffer, data.numberOfChannels, data.sampleRate);
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    const response: AudioWorkerResponse = {
      id,
      success: true,
      data: result,
    };

    const transferables: Transferable[] = [];
    if (result.channelData) {
      result.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
    } else if (result.before?.channelData) {
      result.before.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
      result.after.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
    } else if (result.left?.channelData) {
      result.left.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
      result.right.channelData.forEach((arr: Float32Array) => {
        transferables.push(arr.buffer);
      });
    }

    (self.postMessage as (message: AudioWorkerResponse, transfer?: Transferable[]) => void)(
      response,
      transferables.length > 0 ? transferables : undefined
    );
  } catch (error) {
    const response: AudioWorkerResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
