import { createSignal } from "solid-js";
import { useAudioStore } from "../stores/audioStore";

export const useFileImport = () => {
  const { addTrack } = useAudioStore();
  const [isLoading, setIsLoading] = createSignal(false);

  const processFile = async (file: File) => {
    const audioUrl = URL.createObjectURL(file);
    const audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    await addTrack({
      name: file.name,
      audioBuffer,
      audioUrl,
      duration: audioBuffer.duration,
      backgroundColor: null,
      volume: 1,
      muted: false,
      soloed: false,
    });
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
    if (fileArray.length === 0) return;

    setIsLoading(true);
    try {
      await Promise.all(fileArray.map((file) => processFile(file)));
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
