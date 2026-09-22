/**
 * Model Management Abstraction Layer
 * 
 * Prepares MediPath Part A architecture for native Android deployment
 * with on-device Qualcomm NPU / GPU / CPU runtimes (such as Gemma 4 E2B-it).
 * 
 * Boundary:
 * - This defines standard lifecycle contracts: check installation, download, progress, load, delete.
 * - In the web prototype, provides realistic, honest simulation states without fabricating actual native execution.
 */

export type ModelInstallationStatus = 
  | 'not-installed'
  | 'downloading'
  | 'verifying'
  | 'installed'
  | 'loading'
  | 'ready'
  | 'error';

export type ModelInferenceTarget = 'NPU' | 'GPU' | 'CPU';

export interface ModelDownloadProgress {
  status: ModelInstallationStatus;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speedMbps?: number;
  error?: string;
}

export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  targetArchitecture: string; // e.g., 'Snapdragon / Qualcomm QNN'
  hardwareBacking: ModelInferenceTarget[];
  sizeBytes: number;
  formattedSize: string;
  isMultimodal: boolean;
  isDiagnostic: boolean; // MUST be false for General Gemma models
  description: string;
}

export interface ModelManager {
  getModelMetadata(): ModelMetadata;
  isModelInstalled(): Promise<boolean>;
  getModelStatus(): ModelInstallationStatus;
  getModelVersion(): string;
  getModelSize(): number;
  onProgress(callback: (progress: ModelDownloadProgress) => void): () => void;
  downloadModel(): Promise<void>;
  cancelDownload(): void;
  loadModel(): Promise<boolean>;
  deleteModel(): Promise<void>;
}
