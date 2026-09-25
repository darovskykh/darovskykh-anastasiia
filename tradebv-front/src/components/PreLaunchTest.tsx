import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, MicOff, Volume2, VolumeX, Camera, CameraOff, CheckCircle, AlertCircle, Monitor } from 'lucide-react';
import { wsService } from '@/services/websocket';
import { apiClient } from '@/services/api';
import { sessionRecordingService } from '@/services/sessionRecordingService';
import { useLanguage } from '@/contexts/LanguageContext';
import lamejsScriptUrl from 'lamejs/lame.min.js?url';

const MP3_BITRATE = 128;
const TARGET_MP3_MIME_TYPE = 'audio/mpeg';
const MP3_FILE_NAME = 'microphone-test.mp3';
const MP3_FRAME_SIZE = 1152;
// Beat to get ready + longer window: recording the instant the button is clicked
// captured silence, which the STT hallucinated into random text.
const MIC_PREPARE_SECONDS = 3;
const MIC_RECORD_MS = 5000;
declare global {
  interface Window {
    lamejs?: LameJsModule;
  }
}

interface LameJsModule {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  };
}

type AudioEncoderConfig = {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  bitrate: number;
};

type AudioEncoderSupport = {
  supported: boolean;
};

type AudioEncoderInstance = {
  configure: (config: AudioEncoderConfig) => void;
  encode: (data: any) => void;
  flush: () => Promise<void>;
  close: () => void;
};

declare const AudioEncoder: {
  new(init: { output: (chunk: any) => void; error: (error: any) => void }): AudioEncoderInstance;
  isConfigSupported: (config: AudioEncoderConfig) => Promise<AudioEncoderSupport>;
} | undefined;

declare const AudioData: {
  new(init: {
    format: string;
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: number;
    timestamp: number;
    data: ArrayBuffer;
  }): any;
} | undefined;

interface PreLaunchTestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTestComplete: () => void;
  /** Historical personas omit the flag and remain voice enabled. */
  voiceEnabled?: boolean;
}

interface TestResult {
  microphone: 'success' | 'error' | 'testing';
  audio: 'success' | 'error' | 'testing';
  camera: 'success' | 'error' | 'testing';
  screen: 'success' | 'error' | 'testing';
}

const GET_USER_MEDIA_UNSUPPORTED = 'GET_USER_MEDIA_UNSUPPORTED';
const GET_USER_MEDIA_NO_AUDIO_INPUT = 'GET_USER_MEDIA_NO_AUDIO_INPUT';
const GET_USER_MEDIA_AUDIO_INPUT_UNAVAILABLE = 'GET_USER_MEDIA_AUDIO_INPUT_UNAVAILABLE';
const FIREFOX_OBJECT_NOT_FOUND_RE = /object can not be found here/i;

const isDomException = (error: unknown): error is DOMException => {
  return typeof DOMException !== 'undefined' && error instanceof DOMException;
};

const isMicNotFoundError = (error: unknown): boolean => {
  if (!isDomException(error)) return false;
  return error.name === 'NotFoundError' || FIREFOX_OBJECT_NOT_FOUND_RE.test(error.message || '');
};

const getMicrophoneStream = async (selectedDeviceId?: string): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(GET_USER_MEDIA_UNSUPPORTED);
  }

  const preferredAudioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
  };

  const errors: unknown[] = [];
  const tryGetStream = async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      errors.push(error);
      return null;
    }
  };

  if (selectedDeviceId) {
    const selectedWithPreferred = await tryGetStream({ audio: preferredAudioConstraints });
    if (selectedWithPreferred) return selectedWithPreferred;

    const selectedBasic = await tryGetStream({
      audio: { deviceId: { exact: selectedDeviceId } },
    });
    if (selectedBasic) return selectedBasic;
  }

  const preferredStream = await tryGetStream({ audio: preferredAudioConstraints });
  if (preferredStream) return preferredStream;

  const basicStream = await tryGetStream({ audio: true });
  if (basicStream) return basicStream;

  const hasNotFoundLikeError = errors.some(isMicNotFoundError);
  if (hasNotFoundLikeError && navigator.mediaDevices.enumerateDevices) {
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const audioInputs = devices.filter(
      (device) => device.kind === 'audioinput' && Boolean(device.deviceId)
    );

    if (!audioInputs.length) {
      throw new Error(GET_USER_MEDIA_NO_AUDIO_INPUT);
    }

    const prioritizedInputs = [
      ...audioInputs.filter(
        (device) => device.deviceId !== 'default' && device.deviceId !== 'communications'
      ),
      ...audioInputs.filter(
        (device) => device.deviceId === 'default' || device.deviceId === 'communications'
      ),
    ];

    for (const input of prioritizedInputs) {
      const exactWithPreferred = await tryGetStream({
        audio: {
          ...preferredAudioConstraints,
          deviceId: { exact: input.deviceId },
        },
      });
      if (exactWithPreferred) return exactWithPreferred;

      const exactBasic = await tryGetStream({
        audio: { deviceId: { exact: input.deviceId } },
      });
      if (exactBasic) return exactBasic;
    }

    throw new Error(GET_USER_MEDIA_AUDIO_INPUT_UNAVAILABLE);
  }

  const lastError = errors[errors.length - 1];
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('MICROPHONE_ACCESS_FAILED');
};

const getAudioContext = (): AudioContext => {
  const AudioContextClass =
    window.AudioContext ||
    // @ts-expect-error Safari prefix
    window.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error('AudioContext is not supported in this browser.');
  }

  return new AudioContextClass();
};

const decodeToAudioBuffer = (context: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> => {
  return new Promise((resolve, reject) => {
    context.decodeAudioData(
      arrayBuffer.slice(0),
      (buffer) => resolve(buffer),
      (error) => reject(error)
    );
  });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const canUseAudioEncoder = (): boolean => {
  return (
    typeof AudioEncoder !== 'undefined' &&
    AudioEncoder !== undefined &&
    typeof AudioEncoder.isConfigSupported === 'function' &&
    typeof AudioData !== 'undefined' &&
    AudioData !== undefined
  );
};

const convertFloat32ToInt16 = (buffer: Float32Array): Int16Array => {
  const output = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
};

class Mp3TranscodeError extends Error {
  constructor(message: string = 'MP3 transcoding failed') {
    super(message);
    this.name = 'MP3_TRANSCODE_ERROR';
  }
}

const loadLameJs = async (): Promise<LameJsModule> => {
  if (window.lamejs) {
    return window.lamejs;
  }

  return new Promise((resolve, reject) => {
    const resolveWithLame = () => {
      if (window.lamejs?.Mp3Encoder) {
        resolve(window.lamejs);
      } else {
        reject(new Mp3TranscodeError('Failed to initialize MP3 encoder library.'));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-lamejs="true"]');
    if (existing) {
      existing.addEventListener('load', resolveWithLame, { once: true });
      existing.addEventListener('error', () => reject(new Mp3TranscodeError('Failed to load MP3 encoder library.')), {
        once: true
      });
      return;
    }

    const script = document.createElement('script');
    script.src = lamejsScriptUrl;
    script.async = true;
    script.dataset.lamejs = 'true';
    script.onload = resolveWithLame;
    script.onerror = () => reject(new Mp3TranscodeError('Failed to load MP3 encoder library.'));
    document.head.appendChild(script);
  });
};

const encodeWithLame = async (audioBuffer: AudioBuffer, mp3MimeType: string): Promise<Blob> => {
  const lame = await loadLameJs();
  if (!lame?.Mp3Encoder) {
    throw new Mp3TranscodeError('MP3 encoder library is unavailable.');
  }

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const leftChannel = convertFloat32ToInt16(audioBuffer.getChannelData(0));
  const rightChannel = channels > 1 ? convertFloat32ToInt16(audioBuffer.getChannelData(1)) : null;

  const encoder = new lame.Mp3Encoder(channels, sampleRate, MP3_BITRATE);
  const mp3Chunks: Int8Array[] = [];

  for (let i = 0; i < leftChannel.length; i += MP3_FRAME_SIZE) {
    const leftChunk = leftChannel.subarray(i, Math.min(i + MP3_FRAME_SIZE, leftChannel.length));
    const rightChunk = rightChannel
      ? rightChannel.subarray(i, Math.min(i + MP3_FRAME_SIZE, rightChannel.length))
      : undefined;

    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(mp3buf);
    }
  }

  const flushBuf = encoder.flush();
  if (flushBuf.length > 0) {
    mp3Chunks.push(flushBuf);
  }

  if (!mp3Chunks.length) {
    throw new Mp3TranscodeError('MP3 encoder produced empty output.');
  }

  return new Blob(mp3Chunks, { type: mp3MimeType });
};

const encodeWithAudioEncoder = async (audioBuffer: AudioBuffer, mp3MimeType: string): Promise<Blob> => {
  if (!AudioEncoder || !AudioData) {
    throw new Mp3TranscodeError('MP3 encoding is not supported in this browser.');
  }

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  const config: AudioEncoderConfig = {
    codec: 'mp3',
    sampleRate,
    numberOfChannels,
    bitrate: MP3_BITRATE * 1000
  };

  const support = await AudioEncoder.isConfigSupported(config);
  if (!support.supported) {
    throw new Mp3TranscodeError('MP3 codec is not supported by AudioEncoder.');
  }

  const encodedChunks: Uint8Array[] = [];
  let encodeError: Error | null = null;

  const encoder = new AudioEncoder({
    output: (chunk) => {
      const buffer = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buffer);
      encodedChunks.push(buffer);
    },
    error: (error) => {
      encodeError = error instanceof Error ? error : new Error(String(error));
    }
  });

  encoder.configure(config);

  const totalFrames = audioBuffer.length;
  let frameOffset = 0;
  let timestamp = 0;

  try {
    while (frameOffset < totalFrames) {
      const frameCount = Math.min(MP3_FRAME_SIZE, totalFrames - frameOffset);
      const planarBuffer = new ArrayBuffer(frameCount * numberOfChannels * Float32Array.BYTES_PER_ELEMENT);

      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = new Float32Array(planarBuffer, channel * frameCount * Float32Array.BYTES_PER_ELEMENT, frameCount);
        audioBuffer.copyFromChannel(channelData, channel, frameOffset);
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frameCount,
        numberOfChannels,
        timestamp,
        data: planarBuffer
      });

      encoder.encode(audioData);
      audioData.close();
      frameOffset += frameCount;
      timestamp += Math.round((frameCount / sampleRate) * 1_000_000);
    }

    await encoder.flush();
  } catch (error) {
    throw new Mp3TranscodeError(error instanceof Error ? error.message : 'MP3 encoding failed.');
  } finally {
    try {
      encoder.close();
    } catch {
      // ignore
    }
  }

  if (encodeError) {
    throw new Mp3TranscodeError(encodeError.message);
  }

  if (!encodedChunks.length) {
    throw new Mp3TranscodeError('MP3 encoder returned no data.');
  }

  return new Blob(encodedChunks, { type: mp3MimeType });
};

const encodeBlobToMp3 = async (blob: Blob, mp3MimeType: string): Promise<Blob> => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = getAudioContext();
  let audioBuffer: AudioBuffer | null = null;

  try {
    audioBuffer = await decodeToAudioBuffer(audioContext, arrayBuffer);
  } finally {
    try {
      await audioContext.close();
    } catch {
      // ignore
    }
  }

  if (!audioBuffer) {
    throw new Mp3TranscodeError('Failed to decode recorded audio.');
  }

  if (canUseAudioEncoder()) {
    try {
      return await encodeWithAudioEncoder(audioBuffer, mp3MimeType);
    } catch (error) {
      console.warn('[EquipmentTest] AudioEncoder MP3 encoding failed, falling back to lamejs.', error);
    }
  }

  return encodeWithLame(audioBuffer, mp3MimeType);
};

export const PreLaunchTest: React.FC<PreLaunchTestProps> = ({
  open,
  onOpenChange,
  onTestComplete,
  voiceEnabled = true,
}) => {
  const { t, language } = useLanguage();
  const [testResults, setTestResults] = useState<TestResult>({
    microphone: 'testing',
    audio: 'testing',
    camera: 'testing',
    screen: 'testing',
  });
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const [isTestingScreen, setIsTestingScreen] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [microphoneError, setMicrophoneError] = useState<string>('');
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  // Mic-test phase cues: countdown before recording, then "speak now".
  const [micCountdown, setMicCountdown] = useState<number | null>(null);
  const [isSpeakNow, setIsSpeakNow] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const maxAudioLevelRef = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);

  useEffect(() => {
    if (open && voiceEnabled === false) {
      onOpenChange(false);
      onTestComplete();
    }
  }, [open, voiceEnabled, onOpenChange, onTestComplete]);

  // Connect WebSocket when dialog opens
  useEffect(() => {
    if (open && !wsService.isConnected()) {
      const token = localStorage.getItem('auth_token');
      wsService.connect(token || undefined).then(() => {
        console.log('WebSocket connected for equipment tests');
      }).catch(error => {
        console.error('Failed to connect WebSocket:', error);
      });
    }
  }, [open]);

  // Load available microphones when dialog opens
  useEffect(() => {
    if (open && voiceEnabled !== false) {
      loadMicrophones();
      const savedMicId = localStorage.getItem('selectedMicrophoneId');
      if (savedMicId) {
        setSelectedMicrophoneId(savedMicId);
      }
    }
  }, [open, voiceEnabled]);

  useEffect(() => {
    return () => {
      stopAudioMonitoring();
    };
  }, []);

  const loadMicrophones = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const allMicrophones = devices.filter((device) => device.kind === 'audioinput');

      const normalizeLabel = (label: string): string => {
        if (!label) return '';
        const prefixPattern = /^(Default|По умолчанию|Оборудование|Equipment|Communications|Связь)\s*[-–—]\s*/i;
        return label
          .replace(prefixPattern, '')
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase();
      };

      const uniqueMicrophones = new Map<string, MediaDeviceInfo>();
      const deviceIdMap = new Map<string, MediaDeviceInfo>();

      for (const mic of allMicrophones) {
        if (!mic.deviceId && uniqueMicrophones.size > 0) continue;
        if (mic.deviceId && deviceIdMap.has(mic.deviceId)) continue;

        const normalizedLabel = mic.label ? normalizeLabel(mic.label) : '';
        const isDefaultDevice = mic.deviceId === 'default' || mic.deviceId === 'communications';
        const hasPrefix = mic.label && normalizeLabel(mic.label) !== mic.label;

        const key = normalizedLabel || mic.deviceId || 'default';

        if (mic.deviceId) {
          deviceIdMap.set(mic.deviceId, mic);
        }

        if (!uniqueMicrophones.has(key)) {
          uniqueMicrophones.set(key, mic);
        } else {
          const existing = uniqueMicrophones.get(key)!;
          const existingIsDefault = existing.deviceId === 'default' || existing.deviceId === 'communications';
          const existingHasPrefix = existing.label && normalizeLabel(existing.label) !== existing.label;

          let shouldReplace = false;
          if (existingHasPrefix && !hasPrefix) {
            shouldReplace = true;
          } else if (!existingHasPrefix && hasPrefix) {
            shouldReplace = false;
          } else {
            if (existingIsDefault && !isDefaultDevice) {
              shouldReplace = true;
            } else if (!existingIsDefault && isDefaultDevice) {
              shouldReplace = false;
            } else {
              shouldReplace = !existing.label && !!mic.label;
            }
          }
          if (shouldReplace) {
            uniqueMicrophones.set(key, mic);
          }
        }
      }

      const microphones = Array.from(uniqueMicrophones.values());
      setAvailableMicrophones(microphones);

      if (!selectedMicrophoneId && microphones.length > 0) {
        const savedMicId = localStorage.getItem('selectedMicrophoneId');
        if (savedMicId && microphones.some((mic) => mic.deviceId === savedMicId)) {
          setSelectedMicrophoneId(savedMicId);
        } else {
          setSelectedMicrophoneId(microphones[0].deviceId);
        }
      }
    } catch (error) {
      console.error('Failed to load microphones:', error);
    }
  };

  const startAudioMonitoring = (stream: MediaStream) => {
    try {
      const audioContext = getAudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;

      source.connect(analyser);
      analyserRef.current = analyser;

      isMonitoringRef.current = true;
      maxAudioLevelRef.current = 0;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);

      const updateAudioLevel = () => {
        if (!analyserRef.current || !isMonitoringRef.current) return;

        analyserRef.current.getFloatTimeDomainData(dataArray);

        let sum = 0;
        let peak = 0;
        for (let i = 0; i < bufferLength; i++) {
          const sample = Math.abs(dataArray[i]);
          sum += sample * sample;
          if (sample > peak) peak = sample;
        }
        const rms = Math.sqrt(sum / bufferLength);
        const rmsDb = rms > 0.0001 ? 20 * Math.log10(rms) : -60;
        const peakDb = peak > 0.0001 ? 20 * Math.log10(peak) : -60;

        const clampedPeakDb = Math.max(-60, Math.min(0, peakDb));
        const normalizedLevel = Math.min(100, Math.max(0, ((clampedPeakDb + 60) / 60) * 100));

        const clampedRmsDb = Math.max(-60, Math.min(0, rmsDb));
        const maxLevel = Math.min(100, Math.max(0, ((clampedRmsDb + 60) / 60) * 100));
        if (maxLevel > maxAudioLevelRef.current) {
          maxAudioLevelRef.current = maxLevel;
        }

        setAudioLevel(normalizedLevel);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (error) {
      console.error('Failed to start audio monitoring:', error);
    }
  };

  const stopAudioMonitoring = () => {
    isMonitoringRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setAudioLevel(0);
  };

  const handleMicrophoneChange = (deviceId: string) => {
    setSelectedMicrophoneId(deviceId);
    localStorage.setItem('selectedMicrophoneId', deviceId);
  };

  const mapMicrophoneError = (error: unknown): string => {
    if (error instanceof Error && error.message === GET_USER_MEDIA_UNSUPPORTED) {
      return t('equipmentTest.microphone.unsupported');
    }
    if (error instanceof Error && error.message === GET_USER_MEDIA_NO_AUDIO_INPUT) {
      return t('equipmentTest.microphone.notFound');
    }
    if (error instanceof Error && error.message === GET_USER_MEDIA_AUDIO_INPUT_UNAVAILABLE) {
      return t('equipmentTest.microphone.notReadable');
    }
    if (!isDomException(error)) {
      return t('equipmentTest.microphone.testFailed');
    }
    const domError = error as DOMException;
    if (domError.name === 'NotAllowedError' || domError.name === 'SecurityError') {
      return t('equipmentTest.microphone.permissionDenied');
    }
    if (isMicNotFoundError(error)) {
      return t('equipmentTest.microphone.notFound');
    }
    if (domError.name === 'NotReadableError' || domError.name === 'AbortError') {
      return t('equipmentTest.microphone.notReadable');
    }
    if (domError.name === 'InvalidStateError') {
      return t('equipmentTest.microphone.invalidState');
    }
    return t('equipmentTest.microphone.testFailed');
  };

  const testMicrophone = async () => {
    setIsTestingMic(true);
    setTranscription('');
    setMicrophoneError('');
    setAudioLevel(0);
    setMicCountdown(null);
    setIsSpeakNow(false);
    maxAudioLevelRef.current = 0;
    let stream: MediaStream | null = null;

    try {
      const savedMicId = localStorage.getItem('selectedMicrophoneId');
      stream = await getMicrophoneStream(savedMicId || undefined);
      microphoneStreamRef.current = stream;

      startAudioMonitoring(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const maxLevel = maxAudioLevelRef.current;
        setIsSpeakNow(false);
        stopAudioMonitoring();

        const recordedMime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedMime });

        if (audioBlob.size === 0 || maxLevel < 0.1) {
          setTestResults((prev) => ({ ...prev, microphone: 'error' }));
          setMicrophoneError(t('equipmentTest.microphone.noAudioDetected') || 'No audio detected. Please check your microphone and try again.');
          stream.getTracks().forEach((track) => track.stop());
          microphoneStreamRef.current = null;
          setIsTestingMic(false);
          return;
        }

        try {
          const mp3Blob = await encodeBlobToMp3(audioBlob, TARGET_MP3_MIME_TYPE);
          const base64Audio = await blobToBase64(mp3Blob);
          const base64Data = base64Audio.split(',')[1];

          console.log('[EquipmentTest] Prepared MP3 payload', {
            originalType: recordedMime,
            targetMime: TARGET_MP3_MIME_TYPE,
            originalSize: audioBlob.size,
            mp3Size: mp3Blob.size
          });

          console.log('[EquipmentTest] Sending audio-test request…');
          const response = await apiClient.post<{ event: string; data: { transcription: string } }>(
            '/simulation/audio-test',
            {
              audio_base_64: base64Data,
              file_name: MP3_FILE_NAME,
              lang: language,
            }
          );
          console.log('[EquipmentTest] audio-test response received', response);

          if (response.data && response.data.transcription) {
            setTranscription(response.data.transcription);
            setTestResults(prev => ({ ...prev, microphone: 'success' }));
            setMicrophoneError('');
            console.log('[EquipmentTest] Transcription text:', response.data.transcription);
          } else {
            setTestResults(prev => ({ ...prev, microphone: 'error' }));
            setMicrophoneError(t('equipmentTest.microphone.noSpeechDetected'));
            console.warn('[EquipmentTest] No transcription returned in response.');
          }
        } catch (error: any) {
          console.error('[EquipmentTest] Microphone test failed:', error);
          setTestResults(prev => ({ ...prev, microphone: 'error' }));

          if (error?.name === 'MP3_TRANSCODE_ERROR') {
            setMicrophoneError(t('equipmentTest.microphone.mp3NotSupported'));
          } else {
            const backendMessage = error?.details?.detail || error?.response?.data?.detail;
            const fallbackMessage = backendMessage || error?.message;
            setMicrophoneError(fallbackMessage || t('equipmentTest.microphone.testFailed'));
          }
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          microphoneStreamRef.current = null;
          setIsTestingMic(false);
        }
      };

      // Count down before recording; the level meter is already live.
      for (let n = MIC_PREPARE_SECONDS; n > 0; n--) {
        setMicCountdown(n);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setMicCountdown(null);

      // Dialog closed mid-countdown — don't start a recording nobody will see.
      if (!microphoneStreamRef.current) {
        return;
      }

      setIsSpeakNow(true);
      mediaRecorder.start();

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, MIC_RECORD_MS);
    } catch (error) {
      stopAudioMonitoring();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        microphoneStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
      setMicCountdown(null);
      setIsSpeakNow(false);
      console.error('Microphone access failed:', error);
      setTestResults((prev) => ({ ...prev, microphone: 'error' }));
      setMicrophoneError(mapMicrophoneError(error));
      setIsTestingMic(false);
    }
  };

  const testAudio = async () => {
    setIsTestingAudio(true);

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 1);
      oscillator.onended = () => {
        audioContext.close().catch(() => {
          // ignore
        });
      };

      const response = await apiClient.post<{ event: string; data: { status: string; message: string } }>(
        '/simulation/equipment/test/audio'
      );

      if (response.data && response.data.status === 'success') {
        setTestResults(prev => ({ ...prev, audio: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, audio: 'error' }));
      }
    } catch (error) {
      console.error('Audio test failed:', error);
      setTestResults(prev => ({ ...prev, audio: 'error' }));
    } finally {
      setIsTestingAudio(false);
    }
  };

const testCamera = async () => {
  setIsTestingCamera(true);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());

      const response = await apiClient.post<{ event: string; data: { status: string; message: string } }>(
        '/simulation/equipment/test/camera'
      );

      if (response.data && response.data.status === 'success') {
        setTestResults(prev => ({ ...prev, camera: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, camera: 'error' }));
      }
    } catch (error) {
      console.error('Camera access failed:', error);
      setTestResults(prev => ({ ...prev, camera: 'error' }));
  } finally {
    setIsTestingCamera(false);
  }
};

const testScreenCapture = async (
  setIsTestingScreen: (v: boolean) => void,
  setTestResults: React.Dispatch<React.SetStateAction<TestResult>>
) => {
  setIsTestingScreen(true);
  try {
    const stream = await sessionRecordingService.prepareDisplayStream();
    if (!stream.getVideoTracks().length) {
      throw new Error('Display stream has no video tracks');
    }
    setTestResults(prev => ({ ...prev, screen: 'success' }));
  } catch (error) {
    console.error('Screen capture access failed:', error);
    setTestResults(prev => ({ ...prev, screen: 'error' }));
  } finally {
    setIsTestingScreen(false);
  }
};

  const getStatusIcon = (status: 'success' | 'error' | 'testing') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <div className="h-4 w-4 border-2 border-muted animate-spin rounded-full border-t-primary" />;
    }
  };

  const getStatusBadge = (status: 'success' | 'error' | 'testing') => {
    const label = status === 'success'
      ? t('equipmentTest.status.ready')
      : status === 'error'
        ? t('equipmentTest.status.error')
        : t('equipmentTest.status.testing');

    const statusClasses = status === 'success'
      ? 'border-green-200 text-green-700 bg-green-50'
      : status === 'error'
        ? 'border-red-200 text-red-700 bg-red-50'
        : 'border-muted text-muted-foreground';

    return (
      <Badge variant="outline" className={`uppercase tracking-wide ${statusClasses}`}>
        {label}
      </Badge>
    );
  };

  const allTestsPassed =
    testResults.microphone === 'success' &&
    testResults.audio === 'success' &&
    testResults.camera === 'success' &&
    testResults.screen === 'success';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="max-h-[90vh] overflow-y-auto sm:max-h-[80vh] sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t('equipmentTest.title')}</DialogTitle>
          <DialogDescription>
            {t('equipmentTest.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Microphone Test */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-muted rounded-lg">
                  {isTestingMic ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{t('equipmentTest.microphone.title')}</p>
                  <p className="text-sm text-muted-foreground break-words">
                    {isTestingMic
                      ? micCountdown !== null
                        ? t('equipmentTest.microphone.getReady')
                        : isSpeakNow
                          ? t('equipmentTest.microphone.speakNow')
                          : t('equipmentTest.microphone.recording')
                      : t('equipmentTest.microphone.description')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(testResults.microphone)}
                {getStatusBadge(testResults.microphone)}
              </div>
            </div>
            {transcription && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">{t('equipmentTest.transcription.label')}</p>
                {/* The point here is only "the mic picked something up", so one
                    line is enough; letting it grow pushed the device pickers and
                    the continue button off the dialog. Full text on hover. */}
                <p
                  className="truncate text-sm text-muted-foreground italic"
                  title={transcription}
                >
                  "{transcription}"
                </p>
              </div>
            )}
            {microphoneError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg max-h-32 overflow-y-auto">
                <p className="text-sm text-destructive break-words">{microphoneError}</p>
              </div>
            )}

            {/* Microphone Selection */}
            {availableMicrophones.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('equipmentTest.microphone.selectDevice') || 'Select Microphone:'}
                </label>
                <Select
                  value={selectedMicrophoneId}
                  onValueChange={handleMicrophoneChange}
                  disabled={isTestingMic}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('equipmentTest.microphone.selectPlaceholder') || 'Select a microphone'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMicrophones.map((microphone) => (
                      <SelectItem key={microphone.deviceId} value={microphone.deviceId}>
                        {microphone.label || `Microphone ${microphone.deviceId.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Get-ready countdown */}
            {isTestingMic && micCountdown !== null && (
              <div className="flex flex-col items-center py-2">
                <div className="text-4xl font-bold text-primary tabular-nums leading-none">{micCountdown}</div>
                <p className="mt-1 text-sm text-muted-foreground">{t('equipmentTest.microphone.getReady')}</p>
              </div>
            )}

            {/* Speak-now cue */}
            {isTestingMic && isSpeakNow && (
              <div className="flex items-center justify-center gap-2 py-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-semibold text-destructive">{t('equipmentTest.microphone.speakNow')}</span>
              </div>
            )}

            {/* Audio Level Indicator */}
            {isTestingMic && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('equipmentTest.microphone.audioLevel') || 'Audio Level:'}
                  </span>
                  <span className="text-sm font-medium">
                    {Math.round(audioLevel)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-100"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Audio Test */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-muted rounded-lg">
                {isTestingAudio ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t('equipmentTest.speakers.title')}</p>
                <p className="text-sm text-muted-foreground break-words">{t('equipmentTest.speakers.description')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(testResults.audio)}
              {getStatusBadge(testResults.audio)}
            </div>
          </div>

          {/* Camera Test */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-muted rounded-lg">
                {isTestingCamera ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t('equipmentTest.camera.title')}</p>
                <p className="text-sm text-muted-foreground break-words">{t('equipmentTest.camera.description')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(testResults.camera)}
              {getStatusBadge(testResults.camera)}
            </div>
          </div>

          {/* Screen Recording Test */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-muted rounded-lg">
                {isTestingScreen ? <CameraOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t('equipmentTest.screen.title')}</p>
                <p className="text-sm text-muted-foreground break-words">{t('equipmentTest.screen.description')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(testResults.screen)}
              {getStatusBadge(testResults.screen)}
            </div>
          </div>

          {/* Test Actions — a 2×2 grid so long localized labels wrap instead of
              overflowing the dialog (4-in-a-row clipped the last button in uk). */}
          <div className="grid grid-cols-2 gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={testMicrophone}
              disabled={isTestingMic}
              className="flex-1 min-w-0"
            >
              <span className="truncate">
                {isTestingMic ? t('equipmentTest.buttons.testing') :
                 testResults.microphone === 'error' ? t('equipmentTest.buttons.retryMicrophone') :
                 testResults.microphone === 'success' ? t('equipmentTest.buttons.testAgain') :
                 t('equipmentTest.buttons.testMicrophone')}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={testAudio}
              disabled={isTestingAudio || testResults.audio === 'success'}
              className="flex-1 min-w-0"
            >
              <span className="truncate">
                {isTestingAudio ? t('equipmentTest.buttons.testing') : t('equipmentTest.buttons.testSpeakers')}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={testCamera}
              disabled={isTestingCamera || testResults.camera === 'success'}
              className="flex-1 min-w-0"
            >
              <span className="truncate">
                {isTestingCamera ? t('equipmentTest.buttons.testing') : t('equipmentTest.buttons.testCamera')}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => testScreenCapture(setIsTestingScreen, setTestResults)}
              disabled={isTestingScreen || testResults.screen === 'success'}
              className="flex-1 min-w-0"
            >
              <span className="truncate">
                {isTestingScreen ? t('equipmentTest.buttons.testing') : t('equipmentTest.buttons.testScreen')}
              </span>
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col space-y-2">
          {!allTestsPassed && (
            <p className="text-sm text-muted-foreground text-center">
              {t('equipmentTest.footer.allTestsRequired')}
            </p>
          )}
          <Button
            onClick={onTestComplete}
            disabled={!allTestsPassed}
            className="w-full"
          >
            {allTestsPassed ? t('equipmentTest.footer.startSimulation') : t('equipmentTest.footer.waitingForTests')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
