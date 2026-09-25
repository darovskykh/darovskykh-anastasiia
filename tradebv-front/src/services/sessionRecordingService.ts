export interface SessionRecordingUploadResponse {
  message: string;
  chat_id: string;
  simulation_recording_url: string;
  size_bytes: number;
}

const DISPLAY_MEDIA_CONSTRAINTS: DisplayMediaStreamConstraints = {
  video: {
    frameRate: { ideal: 15, max: 24 },
  },
  audio: true,
};

class SessionRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private displayStream: MediaStream | null = null;
  private prefetchedDisplayStream: MediaStream | null = null;
  private extraAudioStream: MediaStream | null = null;
  private currentChatId: string | null = null;
  private audioContext: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;
  private audioSources: Map<HTMLAudioElement, MediaElementAudioSourceNode> = new Map();
  private mutationObserver: MutationObserver | null = null;
  private audioCheckInterval: NodeJS.Timeout | null = null;

  async startRecording(chatId: string): Promise<void> {
    this.currentChatId = chatId;
    this.recordedChunks = [];

    // Reuse pre-granted display stream from pre-launch test when available
    const displayStream =
      this.getActiveDisplayStream() || (await navigator.mediaDevices.getDisplayMedia(DISPLAY_MEDIA_CONSTRAINTS));

    this.displayStream = displayStream;
    this.prefetchedDisplayStream = null;
    let combinedStream: MediaStream = displayStream;

    // Create AudioContext and destination for capturing HTML5 audio elements
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume AudioContext if it's suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      
      console.log('🎵 AudioContext created, starting audio capture...');
      
      // Connect all existing audio elements to the destination
      this.captureAllAudioElements();
      
      // Watch for new audio elements being added to the DOM
      this.startWatchingForAudioElements();
      
      // Also periodically check for new audio elements (fallback)
      this.startPeriodicAudioCheck();
    } catch (err) {
      console.warn('Could not create AudioContext for capturing HTML5 audio:', err);
    }

    // Collect all audio sources for mixing
    const audioSources: MediaStream[] = [];
    
    // Add display stream audio if available (system audio from screen share)
    if (displayStream.getAudioTracks().length > 0) {
      audioSources.push(displayStream);
    }
    
    // Add HTML5 audio capture stream if available (bot audio)
    if (this.audioDestination && this.audioDestination.stream.getAudioTracks().length > 0) {
      audioSources.push(this.audioDestination.stream);
    }

    // Always try to attach microphone for user's voice
    // This should be added regardless of other audio tracks
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      this.extraAudioStream = micStream;
      
      // Get microphone tracks and ensure they are enabled
      const micTracks = micStream.getAudioTracks();
      micTracks.forEach(track => {
        // Ensure track is enabled and not muted
        track.enabled = true;
        console.log('🎤 Microphone track:', {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings(),
        });
      });
      
      audioSources.push(micStream);
      console.log('🎤 Microphone added to recording stream, tracks:', micTracks.length);
    } catch (err) {
      console.warn('⚠️ Could not attach microphone to screen recording:', err);
      // Continue recording without microphone if permission denied
    }

    // Mix all audio sources into a single stream using AudioContext
    let finalAudioStream: MediaStream;
    if (audioSources.length > 0 && this.audioContext) {
      // Create a gain node for each source and mix them
      const mixerDestination = this.audioContext.createMediaStreamDestination();
      
      audioSources.forEach((source, index) => {
        try {
          // Create MediaStreamSource from the entire source stream
          const sourceNode = this.audioContext!.createMediaStreamSource(source);
          const gainNode = this.audioContext!.createGain();
          
          // Set gain to 1.0 (full volume) for all sources
          gainNode.gain.value = 1.0;
          
          // Connect: source -> gain -> destination
          sourceNode.connect(gainNode);
          gainNode.connect(mixerDestination);
          
          console.log(`🎵 Connected audio source ${index + 1} to mixer:`, {
            tracks: source.getAudioTracks().length,
            labels: source.getAudioTracks().map(t => t.label),
          });
        } catch (err) {
          console.warn(`⚠️ Could not connect audio source ${index + 1} to mixer:`, err);
        }
      });
      
      finalAudioStream = mixerDestination.stream;
      console.log('🎵 Mixed audio stream created with tracks:', finalAudioStream.getAudioTracks().length);
    } else {
      // Fallback: just combine tracks directly (may not work in all browsers)
      const audioTracks: MediaStreamTrack[] = [];
      audioSources.forEach(source => {
        audioTracks.push(...source.getAudioTracks());
      });
      finalAudioStream = new MediaStream(audioTracks);
      console.log('🎵 Using direct track combination (no mixing):', audioTracks.length, 'tracks');
    }

    // Combine video and mixed audio tracks
    combinedStream = new MediaStream([
      ...displayStream.getVideoTracks(),
      ...finalAudioStream.getAudioTracks(),
    ]);

    // Log audio tracks info with detailed status
    console.log('🎵 Audio tracks in recording stream:', {
      totalTracks: finalAudioStream.getAudioTracks().length,
      displayAudioTracks: displayStream.getAudioTracks().length,
      html5AudioTracks: this.audioDestination ? this.audioDestination.stream.getAudioTracks().length : 0,
      micAudioTracks: this.extraAudioStream ? this.extraAudioStream.getAudioTracks().length : 0,
      trackLabels: finalAudioStream.getAudioTracks().map(t => t.label),
      trackDetails: finalAudioStream.getAudioTracks().map(t => ({
        id: t.id,
        label: t.label,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
        kind: t.kind,
      })),
    });
    
    // Verify combined stream has all tracks
    console.log('🎵 Combined stream tracks:', {
      videoTracks: combinedStream.getVideoTracks().length,
      audioTracks: combinedStream.getAudioTracks().length,
      audioTrackDetails: combinedStream.getAudioTracks().map(t => ({
        id: t.id,
        label: t.label,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
      })),
    });

    const mimeType = this.getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 1500000,
      audioBitsPerSecond: 96000,
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    // Log when recording starts
    this.mediaRecorder.onstart = () => {
      console.log('🎥 Recording started with audio tracks:', combinedStream.getAudioTracks().length);
      // Verify tracks are still active
      combinedStream.getAudioTracks().forEach(track => {
        console.log('🎵 Track status at recording start:', {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        });
      });
    };

    this.mediaRecorder.start(2000);
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No screen recording in progress'));
        return;
      }

      const recorder = this.mediaRecorder;

      recorder.onstop = () => {
        try {
          const mimeType = recorder.mimeType || 'video/webm';
          const blob = new Blob(this.recordedChunks, { type: mimeType });
          this.cleanupStreams();
          this.recordedChunks = [];
          this.mediaRecorder = null;
          resolve(blob);
        } catch (err) {
          reject(err);
        }
      };

      recorder.onerror = (event: any) => {
        reject(new Error(event?.error?.message || 'Failed to stop screen recording'));
      };

      try {
        recorder.stop();
      } catch (err: any) {
        reject(new Error(err?.message || 'Failed to stop screen recording'));
      }
    });
  }

  async uploadRecording(
    chatId: string,
    recordingBlob: Blob,
    onProgress?: (progress: number) => void
  ): Promise<SessionRecordingUploadResponse> {
    const formData = new FormData();
    const filename = `simulation_recording_${chatId}_${Date.now()}.webm`;
    formData.append('file', recordingBlob, filename);
    formData.append('recording_type', 'simulation');

    const doUpload = (url: string): Promise<SessionRecordingUploadResponse> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const token = localStorage.getItem('auth_token');

        xhr.open('POST', url);

        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const progress = Math.round((e.loaded * 100) / e.total);
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response.data);
            } catch (error) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during screen recording upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Screen recording upload aborted'));
        });

        xhr.send(formData);
      });

    const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
    const simulationUrl = `${base}/simulation/${chatId}/upload-simulation-recording`;
    try {
      return await doUpload(simulationUrl);
    } catch (err: any) {
      // Fallback for environments where the new endpoint is unavailable
      if (err?.message?.includes('status 404')) {
        const legacyUrl = `${base}/simulation/${chatId}/upload-recording`;
        return doUpload(legacyUrl);
      }
      throw err;
    }
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  cleanup(): void {
    this.cleanupStreams();
    this.recordedChunks = [];
    this.mediaRecorder = null;
    this.currentChatId = null;
  }

  private cleanupStreams(): void {
    this.stopStream(this.displayStream);
    this.stopStream(this.prefetchedDisplayStream);
    if (this.extraAudioStream) {
      this.extraAudioStream.getTracks().forEach((track) => track.stop());
      this.extraAudioStream = null;
    }
    
    // Cleanup audio capture
    this.stopWatchingForAudioElements();
    this.stopPeriodicAudioCheck();
    this.disconnectAllAudioElements();
    if (this.audioDestination) {
      this.audioDestination.stream.getTracks().forEach((track) => track.stop());
      this.audioDestination = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(console.warn);
      this.audioContext = null;
    }
    
    this.displayStream = null;
    this.prefetchedDisplayStream = null;
  }

  private stopStream(stream: MediaStream | null): void {
    if (!stream) {
      return;
    }
    stream.getTracks().forEach((track) => track.stop());
  }

  private getActiveDisplayStream(): MediaStream | null {
    if (this.isStreamLive(this.displayStream)) {
      return this.displayStream as MediaStream;
    }

    if (this.isStreamLive(this.prefetchedDisplayStream)) {
      return this.prefetchedDisplayStream as MediaStream;
    }

    return null;
  }

  async prepareDisplayStream(): Promise<MediaStream> {
    const existing = this.getActiveDisplayStream();
    if (existing) {
      return existing;
    }

    // Stop any stale prefetched stream before requesting a new one
    this.stopStream(this.prefetchedDisplayStream);

    const stream = await navigator.mediaDevices.getDisplayMedia(DISPLAY_MEDIA_CONSTRAINTS);
    this.prefetchedDisplayStream = stream;
    return stream;
  }

  private isStreamLive(stream: MediaStream | null): boolean {
    return !!stream?.getTracks().some((track) => track.readyState === 'live');
  }

  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm';
  }

  /**
   * Captures all existing HTML5 audio elements and connects them to the audio destination
   */
  private captureAllAudioElements(): void {
    if (!this.audioContext || !this.audioDestination) {
      return;
    }

    // Find all audio elements in the document (including in shadow DOM if accessible)
    const audioElements = document.querySelectorAll('audio');
    
    console.log(`🎵 Initial scan: Found ${audioElements.length} audio elements in document`);
    
    // Also check if there are any audio elements that might be created via refs
    // (React components might not have them in DOM yet)
    if (audioElements.length === 0) {
      console.log('🎵 No audio elements found initially - will monitor for new ones');
    }
    
    audioElements.forEach((audioElement) => {
      this.connectAudioElement(audioElement);
    });
  }

  /**
   * Connects a single audio element to the audio destination
   */
  private connectAudioElement(audioElement: HTMLAudioElement): void {
    if (!this.audioContext || !this.audioDestination || this.audioSources.has(audioElement)) {
      return;
    }

    try {
      // Try to connect even if src is not set yet - it might be set later
      // But we need to wait for the element to be ready
      const tryConnect = () => {
        try {
          // Create a media source from the audio element
          const source = this.audioContext!.createMediaElementSource(audioElement);
          
          // Connect the source to both the recording destination AND the speakers
          // This way the audio is both recorded and played back
          source.connect(this.audioDestination!);
          source.connect(this.audioContext!.destination);
          
          // Store the source for cleanup
          this.audioSources.set(audioElement, source);
          
          console.log('✅ Connected audio element to recording stream:', {
            src: audioElement.src || 'no src yet',
            currentSrc: audioElement.currentSrc,
            readyState: audioElement.readyState,
          });
        } catch (err: any) {
          // If element is already connected, that's okay - try to reconnect later
          if (err?.message?.includes('already been connected') || 
              err?.message?.includes('already connected')) {
            console.log('ℹ️ Audio element already connected, will retry later:', audioElement.src);
            // Don't mark as connected, so we can retry
            return;
          }
          throw err;
        }
      };

      // Try to connect immediately - createMediaElementSource works even if src is not set yet
      // The connection will be established when the element starts playing
      tryConnect();
      
      // Also try again when the element loads, in case the first attempt failed
      if (audioElement.readyState < 2) {
        const onLoadedData = () => {
          if (!this.audioSources.has(audioElement)) {
            tryConnect();
          }
          audioElement.removeEventListener('loadeddata', onLoadedData);
        };
        audioElement.addEventListener('loadeddata', onLoadedData);
        
        // Also try when play starts
        const onPlay = () => {
          if (!this.audioSources.has(audioElement)) {
            tryConnect();
          }
        };
        audioElement.addEventListener('play', onPlay, { once: true });
      }
    } catch (err: any) {
      console.warn('⚠️ Could not connect audio element to recording stream:', {
        error: err?.message,
        src: audioElement.src,
        currentSrc: audioElement.currentSrc,
      });
      // Some audio elements might already be connected to another destination
      // This is expected and not a critical error
    }
  }

  /**
   * Disconnects all audio elements from the audio destination
   */
  private disconnectAllAudioElements(): void {
    this.audioSources.forEach((source, audioElement) => {
      try {
        source.disconnect();
      } catch (err) {
        console.warn('Error disconnecting audio source:', err);
      }
    });
    this.audioSources.clear();
  }

  /**
   * Starts watching for new audio elements being added to the DOM
   */
  private startWatchingForAudioElements(): void {
    if (!this.audioContext || !this.audioDestination) {
      return;
    }

    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            
            // Check if the added node is an audio element
            if (element.tagName === 'AUDIO') {
              console.log('🎵 MutationObserver: Found new audio element in DOM', {
                src: (element as HTMLAudioElement).src || (element as HTMLAudioElement).currentSrc,
              });
              this.connectAudioElement(element as HTMLAudioElement);
            }
            
            // Check if the added node contains audio elements
            const audioElements = element.querySelectorAll?.('audio');
            if (audioElements && audioElements.length > 0) {
              console.log(`🎵 MutationObserver: Found ${audioElements.length} audio elements in added node`);
              audioElements.forEach((audioElement) => {
                this.connectAudioElement(audioElement);
              });
            }
          }
        });
      });
    });

    // Start observing the entire document for new audio elements
    // Use document.documentElement to catch elements added anywhere, including React portals
    const targetNode = document.documentElement || document.body;
    this.mutationObserver.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true, // Also watch for src attribute changes
      attributeFilter: ['src'], // Only watch src changes to reduce overhead
    });
    
    console.log('🎵 MutationObserver started, watching for new audio elements');
  }

  /**
   * Stops watching for new audio elements
   */
  private stopWatchingForAudioElements(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  /**
   * Starts periodic checking for new audio elements (fallback method)
   */
  private startPeriodicAudioCheck(): void {
    if (!this.audioContext || !this.audioDestination) {
      return;
    }

    // Check more frequently (every 500ms) for new audio elements
    this.audioCheckInterval = setInterval(() => {
      if (!this.audioContext || !this.audioDestination) {
        return;
      }

      const audioElements = document.querySelectorAll('audio');
      let newElementsCount = 0;
      
      audioElements.forEach((audioElement) => {
        if (!this.audioSources.has(audioElement)) {
          newElementsCount++;
          console.log('🎵 Periodic check: Found new audio element, connecting...', {
            src: audioElement.src || audioElement.currentSrc,
            readyState: audioElement.readyState,
          });
          this.connectAudioElement(audioElement);
        }
      });

      if (newElementsCount > 0) {
        console.log(`🎵 Periodic check: Connected ${newElementsCount} new audio elements`);
      }
    }, 500); // Check every 500ms instead of 2 seconds

    // Also listen for play events globally to catch audio elements when they start playing
    const handlePlay = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLAudioElement) {
        if (!this.audioSources.has(target)) {
          console.log('🎵 Play event detected on unconnected audio element, connecting...', {
            src: target.src || target.currentSrc,
          });
          this.connectAudioElement(target);
        }
      }
    };

    // Use capture phase to catch events early
    document.addEventListener('play', handlePlay, true);
    
    // Store handler for cleanup
    (this as any)._globalPlayHandler = handlePlay;
  }

  /**
   * Stops periodic checking for new audio elements
   */
  private stopPeriodicAudioCheck(): void {
    if (this.audioCheckInterval) {
      clearInterval(this.audioCheckInterval);
      this.audioCheckInterval = null;
    }
    
    // Remove global play event listener
    const handler = (this as any)._globalPlayHandler;
    if (handler) {
      document.removeEventListener('play', handler, true);
      (this as any)._globalPlayHandler = null;
    }
  }
}

export const sessionRecordingService = new SessionRecordingService();
