import { createSignal, onCleanup } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { getErrorMessage } from "../utils/errorUtils";
import { formatDateForFilename } from "../utils/dateUtils";

function stopMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [recordingDuration, setRecordingDuration] = createSignal(0);
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let recordingStartTime = 0;
  let durationInterval: ReturnType<typeof setInterval> | null = null;
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
        if (event.data && event.data.size > 0) {
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
            stopMediaStream(stream);
            return;
          }

          const audioBlob = new Blob(audioChunks, { type: selectedMimeType });
          const audioUrl = URL.createObjectURL(audioBlob);

          const audioContext = new AudioContext();
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          await addTrack({
            name: `Recording ${formatDateForFilename()}`,
            audioBuffer,
            audioUrl,
            duration: audioBuffer.duration,
            backgroundColor: null,
            volume: 1,
            pan: 0,
            muted: false,
            soloed: false,
            waveformRenderer: "bars",
          });

          stopMediaStream(stream);
        } catch (err) {
          setError(getErrorMessage(err, "Failed to process recording"));
          stopMediaStream(stream);
        }
      };

      setIsRecording(true);
      recordingStartTime = Date.now();
      setRecordingDuration(0);
      durationInterval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartTime) / 1000));
      }, 100);
      mediaRecorder.start(10);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to start recording"));
      setIsRecording(false);
      throw err;
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording()) {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.requestData();
      }
      mediaRecorder.stop();
      setIsRecording(false);
      if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
      }
      setRecordingDuration(0);
    }
  };

  onCleanup(() => {
    if (durationInterval) {
      clearInterval(durationInterval);
    }
  });

  const clearError = () => {
    setError(null);
  };

  return {
    isRecording,
    error,
    recordingDuration,
    startRecording,
    stopRecording,
    clearError,
  };
};
