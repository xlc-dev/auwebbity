import { createSignal } from "solid-js";
import { useAudioStore } from "../stores/audioStore";

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  const { addTrack } = useAudioStore();

  const startRecording = async () => {
    try {
      setError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Your browser doesn't support audio recording. Please use a modern browser."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];

      const mimeTypes = ["audio/webm", "audio/webm;codecs=opus", "audio/ogg", "audio/mp4"];
      let selectedMimeType = "";

      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported audio format found. Please try a different browser.");
      }

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        setError("Recording error occurred");
        console.error("MediaRecorder error:", event);
      };

      mediaRecorder.onstop = async () => {
        try {
          if (audioChunks.length === 0) {
            setError("No audio data recorded");
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          const audioBlob = new Blob(audioChunks, { type: selectedMimeType });
          const audioUrl = URL.createObjectURL(audioBlob);

          const audioContext = new AudioContext();
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          addTrack({
            name: `Recording ${new Date().toLocaleTimeString()}`,
            audioBuffer,
            audioUrl,
            duration: audioBuffer.duration,
          });

          stream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to process recording");
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start recording";
      setError(errorMessage);
      setIsRecording(false);
      throw err;
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording()) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
    clearError,
  };
};
