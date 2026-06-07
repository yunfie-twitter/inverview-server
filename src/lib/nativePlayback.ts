import { registerPlugin } from "@capacitor/core";
import { isCapacitorRuntime } from "./runtimeEnv";

type NativePlaybackPlugin = {
  setPlaybackState(options: {
    playing: boolean;
    autoEnterPipOnBackground?: boolean;
    backgroundPlaybackEnabled?: boolean;
  }): Promise<{ ok: boolean }>;
  setNowPlaying(options: {
    enabled: boolean;
    title?: string;
    artist?: string;
    artworkUrl?: string;
    playbackUrl?: string;
    durationSeconds?: number;
    positionSeconds?: number;
    playing?: boolean;
  }): Promise<{ ok: boolean }>;
  enterPictureInPicture(): Promise<{ ok: boolean; error?: string }>;
  supportsPictureInPicture(): Promise<{ supported: boolean }>;
};

const NativePlayback = registerPlugin<NativePlaybackPlugin>("NativePlayback");

export const setNativePlaybackState = async (
  playing: boolean,
  autoEnterPipOnBackground = true,
  backgroundPlaybackEnabled = true,
): Promise<void> => {
  if (!isCapacitorRuntime()) return;
  try {
    await NativePlayback.setPlaybackState({ playing, autoEnterPipOnBackground, backgroundPlaybackEnabled });
  } catch {
    // no-op
  }
};

export const setNativeNowPlaying = async (options: {
  enabled: boolean;
  title?: string;
  artist?: string;
  artworkUrl?: string;
  playbackUrl?: string;
  durationSeconds?: number;
  positionSeconds?: number;
  playing?: boolean;
}): Promise<void> => {
  if (!isCapacitorRuntime()) return;
  try {
    await NativePlayback.setNowPlaying(options);
  } catch {
    // no-op
  }
};

export const enterNativePictureInPicture = async (): Promise<boolean> => {
  if (!isCapacitorRuntime()) return false;
  try {
    const result = await NativePlayback.enterPictureInPicture();
    return result.ok;
  } catch {
    return false;
  }
};
