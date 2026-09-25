import { apiClient } from './api';

export interface RecordingUploadResponse {
  message: string;
  chat_id: string;
  recording_url: string;
  size_bytes: number;
}

class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private currentChatId: string | null = null;
  private chunkCounter: number = 0;
  private uploadedChunks: number = 0;
  private readonly CHUNK_UPLOAD_INTERVAL = 30; // Upload every 30 chunks (60 seconds) - less aggressive
  private readonly MAX_CHUNKS_IN_MEMORY = 50; // Increased limit to reduce camera flickering
  private activeXHRRequests: Set<XMLHttpRequest> = new Set();
  private cleanupTimer: number | null = null;
  private memoryMonitorTimer: number | null = null;

  /**
   * Set chat ID for streaming upload
   */
  setChatId(chatId: string): void {
    if (!chatId || chatId === 'undefined' || chatId === 'null') {
      console.error('Invalid chatId provided to recordingService:', chatId);
      return;
    }
    console.log('[rec] setChatId', chatId);
    this.currentChatId = chatId;
  }

  /**
   * Request permission and start recording webcam + microphone
   * With chunked upload to prevent memory overflow
   */
  async startRecording(options?: MediaStreamConstraints): Promise<void> {
    try {
      console.log('[rec] requesting media with options', options);
      // Request webcam and microphone access with quality limits
      this.stream = await navigator.mediaDevices.getUserMedia(
        options || {
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 24 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        }
      );
      console.log(
        '[rec] media granted',
        this.stream.getVideoTracks().map((t) => t.label),
        this.stream.getAudioTracks().map((t) => t.label)
      );

      // Create MediaRecorder with bitrate limit
      const mimeType = this.getSupportedMimeType();
      console.log('[rec] using mimeType', mimeType);
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: 1000000, // 1 Mbps (~7.5 MB/min for 30min = ~225MB)
        audioBitsPerSecond: 64000,   // Lower audio bitrate
      });

      this.recordedChunks = [];
      this.chunkCounter = 0;
      this.uploadedChunks = 0;

      // Collect data chunks - SIMPLIFIED to prevent camera flickering
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          console.log('[rec] chunk collected', {
            size: event.data.size,
            totalChunks: this.recordedChunks.length,
          });
          this.chunkCounter++;

          // DISABLED: Aggressive memory management that caused camera flickering
          // Just collect chunks without cleanup during recording
        }
      };

      // DISABLED: Memory monitoring and periodic cleanup to prevent camera flickering
      // this.startMemoryMonitoring();

      // Start recording - collect chunks every 2 seconds
      this.mediaRecorder.start(2000);
      console.log('[rec] mediaRecorder started');

      // DISABLED: Periodic cleanup to prevent camera flickering during recording
      // this.cleanupTimer = window.setInterval(() => {
      //   this.periodicCleanup();
      // }, 60000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to access camera/microphone. Please grant permissions.');
    }
  }

  /**
   * Upload accumulated chunks to server and free memory
   */
  private async uploadChunksToServer(): Promise<void> {
    if (!this.currentChatId || this.recordedChunks.length === 0) {
      return;
    }

    // Keep last 5 chunks for continuity in long recordings, upload the rest
    const chunksToUpload = this.recordedChunks.slice(0, -5);
    if (chunksToUpload.length === 0) {
      return;
    }

    const blob = new Blob(chunksToUpload, { type: this.mediaRecorder?.mimeType || 'video/webm' });
    const chunkNumber = this.uploadedChunks;

    try {
      await this.uploadChunk(this.currentChatId, blob, chunkNumber);

      // Remove uploaded chunks from memory (keep last 5 for continuity)
      this.recordedChunks = this.recordedChunks.slice(-5);
      this.chunkCounter = this.recordedChunks.length;
      this.uploadedChunks++;
      
      // Immediately force garbage collection after upload
      this.forceGarbageCollection();

      console.log(`✅ Chunk ${chunkNumber} uploaded, freed ${chunksToUpload.length} chunks`);
    } catch (error) {
      console.error('Failed to upload chunk:', error);
      // On error, still free some memory but keep more chunks for retry
      if (this.recordedChunks.length > this.MAX_CHUNKS_IN_MEMORY * 2) {
        this.recordedChunks = this.recordedChunks.slice(-this.MAX_CHUNKS_IN_MEMORY);
        this.chunkCounter = this.recordedChunks.length;
      }
    }
  }

  /**
   * Upload a single chunk to server
   */
  private async uploadChunk(chatId: string, blob: Blob, chunkNumber: number): Promise<void> {
    // ============ LOGGING ============
    const chunkSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const chunkSizeKB = (blob.size / 1024).toFixed(2);
    console.log(`📦 Uploading chunk #${chunkNumber}:`, {
      size: blob.size,
      sizeKB: `${chunkSizeKB} KB`,
      sizeMB: `${chunkSizeMB} MB`,
      type: blob.type,
      chatId
    });
    
    // Проверка: если chunk больше 10MB, выведите предупреждение
    if (blob.size > 10 * 1024 * 1024) {
      console.warn(`⚠️ Large chunk detected: ${chunkSizeMB} MB - may cause upload issues`);
    }
    // ============================================
    const formData = new FormData();
    formData.append('file', blob, `chunk_${chunkNumber}.webm`);
    formData.append('chunk_number', chunkNumber.toString());

    const xhr = new XMLHttpRequest();
    const token = localStorage.getItem('auth_token');
    const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

    this.activeXHRRequests.add(xhr);

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.activeXHRRequests.delete(xhr);
        // Nullify xhr references to help GC
        (xhr as any).onload = null;
        (xhr as any).onerror = null;
        (xhr as any).onabort = null;
        if ((xhr as any).upload) {
          (xhr as any).upload.onprogress = null;
        }
      };

      xhr.open('POST', `${API_BASE_URL}/simulation/${chatId}/upload-chunk`);

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.addEventListener('load', () => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Chunk upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        cleanup();
        reject(new Error('Network error during chunk upload'));
      });

      xhr.addEventListener('abort', () => {
        cleanup();
        reject(new Error('Chunk upload aborted'));
      });

      xhr.send(formData);
    });
  }

  /**
   * Stop recording and upload final chunks
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      // Check if already stopped or inactive
      if (this.mediaRecorder.state === 'inactive') {
        // If already stopped, return existing blob if available
        if (this.recordedChunks.length > 0) {
          const mimeType = this.mediaRecorder.mimeType || 'video/webm';
          const blob = new Blob(this.recordedChunks, { type: mimeType });
          resolve(blob);
        } else {
          reject(new Error('No recording in progress'));
        }
        return;
      }

      // Set up stop handler before calling stop()
      this.mediaRecorder.onstop = async () => {
        try {
          console.log('[rec] mediaRecorder stopped, finalizing');
          // Upload any remaining chunks
          if (this.currentChatId && this.recordedChunks.length > 0) {
            try {
              await this.uploadChunksToServer();
            } catch (error) {
              console.error('Failed to upload final chunks:', error);
              // Don't reject - we still want to return the blob
            }
          }

          const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
          console.log('[rec] building final blob', {
            chunks: this.recordedChunks.length,
            mimeType,
          });
          const blob = new Blob(this.recordedChunks, { type: mimeType });

          this.cleanup();

          resolve(blob);
        } catch (error) {
          console.error('Error in onstop handler:', error);
          reject(error);
        }
      };

      // Handle errors during stop
      this.mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error during stop:', event);
        reject(new Error('Error stopping recording'));
      };

      try {
        this.mediaRecorder.stop();
      } catch (error: any) {
        console.error('Error calling mediaRecorder.stop():', error);
        reject(new Error(`Failed to stop recording: ${error.message || 'Unknown error'}`));
      }
    });
  }

  /**
   * Final upload of complete recording (after assembling chunks on server)
   */
  async uploadRecording(
    chatId: string,
    recordingBlob: Blob,
    onProgress?: (progress: number) => void
  ): Promise<RecordingUploadResponse> {
    const formData = new FormData();
    const filename = `recording_${chatId}_${Date.now()}.webm`;
    formData.append('file', recordingBlob, filename);
    formData.append('total_chunks', this.uploadedChunks.toString());
    formData.append('recording_type', 'webcam');

    const doUpload = (url: string): Promise<RecordingUploadResponse> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const token = localStorage.getItem('auth_token');
        const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

        this.activeXHRRequests.add(xhr);

        const cleanup = () => {
          this.activeXHRRequests.delete(xhr);
          // Nullify xhr references to help GC
          (xhr as any).onload = null;
          (xhr as any).onerror = null;
          (xhr as any).onabort = null;
          if ((xhr as any).upload) {
            (xhr as any).upload.onprogress = null;
          }
        };

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
          cleanup();
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
          cleanup();
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          cleanup();
          reject(new Error('Upload aborted'));
        });

        xhr.send(formData);
      });

    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
    const primaryUrl = `${baseUrl}/simulation/${chatId}/upload-recording`;
    const fallbackUrl = `${baseUrl}/simulation/${chatId}/upload-simulation-recording`;

    try {
      return await doUpload(primaryUrl);
    } catch (err: any) {
      console.warn('[rec] primary upload failed, trying fallback', err?.message);
      if (err?.message?.includes('status 404')) {
        return doUpload(fallbackUrl);
      }
      throw err;
    }
  }

  /**
   * Get the MediaStream for preview
   */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Get supported MIME type for recording
   */
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
   * Cancel recording without saving
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  /**
   * Periodic cleanup to prevent memory accumulation
   */
  private periodicCleanup(): void {
    // Limit chunks in memory
    if (this.recordedChunks.length > this.MAX_CHUNKS_IN_MEMORY) {
      this.recordedChunks = this.recordedChunks.slice(-this.MAX_CHUNKS_IN_MEMORY);
      this.chunkCounter = this.recordedChunks.length;
    }
    
    this.forceGarbageCollection();
  }

  /**
   * Force garbage collection and memory cleanup
   */
  private forceGarbageCollection(): void {
    if (window.gc) {
      window.gc();
    }
    
    // Try to trigger browser memory cleanup
    if ((window as any).MemoryInfo) {
      try {
        (window.performance as any).measureUserAgentSpecificMemory?.();
      } catch (e) {
        // Ignore errors
      }
    }
  }

  /**
   * Start memory monitoring to prevent leaks
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorTimer = window.setInterval(() => {
      if ((window.performance as any).memory) {
        const memory = (window.performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);

        // Only cleanup if memory is VERY high to prevent camera flickering
        if (usedMB > 1000) {
          console.warn(`High memory usage: ${usedMB}MB - triggering cleanup`);
          this.periodicCleanup();

          // If extremely high, clear more chunks
          if (usedMB > 1500) {
            this.recordedChunks = this.recordedChunks.slice(-10);
            this.chunkCounter = this.recordedChunks.length;
          }
        }
      }
    }, 30000); // Check every 30 seconds - less frequent monitoring
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
      this.memoryMonitorTimer = null;
    }
  }

  /**
   * Clean up all resources and prevent memory leaks
   */
  cleanup(): void {
    // Stop timers first
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.stopMemoryMonitoring();

    // Stop and clean MediaRecorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.onerror = null;
      this.mediaRecorder.onstart = null;
      this.mediaRecorder.onpause = null;
      this.mediaRecorder.onresume = null;
      this.mediaRecorder = null;
    }

    // Stop and clean MediaStream with aggressive cleanup
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        // Remove all event listeners
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
        track.onoverconstrained = null;
        
        track.stop();
        
        // Force track disposal
        if ((track as any).clone) {
          (track as any).clone = null;
        }
        
        // Try to force track cleanup
        if ((track as any)._readyState) {
          (track as any)._readyState = 'ended';
        }
      });
      
      // Note: MediaStream.active is read-only, so we can't set it to false
      // The stream will become inactive automatically when all tracks are stopped
      
      // Try to force stream cleanup
      if ((this.stream as any)._tracks) {
        (this.stream as any)._tracks = [];
      }
      
      this.stream = null;
    }

    // More aggressive media devices cleanup
    if (navigator.mediaDevices) {
      try {
        // Try multiple cleanup strategies
        const cleanupStrategies = [
          () => (navigator.mediaDevices as any)._streams = null,
          () => (navigator.mediaDevices as any)._deviceCache = null,
          () => (navigator.mediaDevices as any).permissionCache = null,
        ];
        
        cleanupStrategies.forEach(strategy => {
          try {
            strategy();
          } catch (e) {
            // Ignore individual strategy errors
          }
        });
      } catch (e) {
        // Ignore errors in cleanup attempts
      }
    }

    // Abort active XHR requests
    this.activeXHRRequests.forEach(xhr => {
      try {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          xhr.abort();
        }
      } catch (e) {
        // Ignore abort errors
      }
    });
    this.activeXHRRequests = new Set();

    // Clear memory arrays aggressively
    this.recordedChunks.length = 0;
    this.recordedChunks = [];
    this.chunkCounter = 0;
    this.uploadedChunks = 0;
    this.currentChatId = null;

    // Multiple attempts to force v4l2 cleanup
    const v4l2CleanupStrategies = [
      // Strategy 1: Request dummy stream to reset device
      async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: false });
          stream?.getTracks().forEach(track => track.stop());
        } catch (e) {}
      },
      // Strategy 2: Request minimal video stream to force device reset
      async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1, height: 1, frameRate: 1 }, 
            audio: false 
          });
          setTimeout(() => {
            stream?.getTracks().forEach(track => track.stop());
          }, 100);
        } catch (e) {}
      },
      // Strategy 3: Try to enumerate devices to refresh cache
      async () => {
        try {
          await navigator.mediaDevices.enumerateDevices();
        } catch (e) {}
      }
    ];
    
    // Execute cleanup strategies with delays
    v4l2CleanupStrategies.forEach((strategy, index) => {
      setTimeout(() => strategy(), index * 500);
    });

    // Force multiple garbage collection attempts
    setTimeout(() => this.forceGarbageCollection(), 100);
    setTimeout(() => this.forceGarbageCollection(), 1000);
    setTimeout(() => this.forceGarbageCollection(), 5000);

    console.log('🧹 RecordingService aggressive cleanup completed');
  }
}

export const recordingService = new RecordingService();
