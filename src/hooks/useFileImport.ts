import { createSignal } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { getAudioContext } from "../utils/audioContext";
import { createTrackFromBuffer } from "../utils/trackHelpers";

export const useFileImport = () => {
  const { addTrack } = useAudioStore();
  const [isLoading, setIsLoading] = createSignal(false);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      throw new Error(`Invalid file type: ${file.type}. Please select an audio file.`);
    }

    const audioUrl = URL.createObjectURL(file);
    const audioContext = getAudioContext();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      URL.revokeObjectURL(audioUrl);
      throw new Error(`File "${file.name}" is empty or corrupted.`);
    }

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (error) {
      URL.revokeObjectURL(audioUrl);
      throw new Error(
        `Failed to decode audio file "${file.name}": ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!audioBuffer || audioBuffer.duration <= 0) {
      URL.revokeObjectURL(audioUrl);
      throw new Error(`Invalid audio file "${file.name}": duration is ${audioBuffer.duration}`);
    }

    const track = await createTrackFromBuffer(audioBuffer, audioUrl, file.name);
    await addTrack(track);
  };

  const handleFileImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      await processFile(file);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((file) => file.type.startsWith("audio/"));
    if (fileArray.length === 0) {
      throw new Error("No valid audio files selected");
    }

    setIsLoading(true);
    const errors: string[] = [];
    try {
      const results = await Promise.allSettled(fileArray.map((file) => processFile(file)));

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          errors.push(
            `${fileArray[index]!.name}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
          );
        }
      });

      if (errors.length > 0) {
        const successCount = results.filter((r) => r.status === "fulfilled").length;
        if (successCount > 0) {
          throw new Error(
            `Imported ${successCount} file(s), but ${errors.length} failed:\n${errors.join("\n")}`
          );
        } else {
          throw new Error(`Failed to import all files:\n${errors.join("\n")}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleFileImport,
    handleFiles,
    isLoading,
  };
};
