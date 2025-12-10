import { createSignal } from "solid-js";
import { useAudioStore } from "../stores/audioStore";

export const useFileImport = () => {
  const { addTrack } = useAudioStore();
  const [isLoading, setIsLoading] = createSignal(false);

  const handleFileImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const audioUrl = URL.createObjectURL(file);
      const audioContext = new AudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      addTrack({
        name: file.name,
        audioBuffer,
        audioUrl,
        duration: audioBuffer.duration,
        backgroundColor: null,
      });
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleFileImport,
    isLoading,
  };
};
