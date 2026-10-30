import { useState } from 'react';
import { useMap } from '@hridayanp/map-container';
import { Button, Popover, Tooltip, cx } from '@hridayanp/ui';
import {
  captureMap,
  downloadBlob,
  recordMapAnimation,
  type CaptureOptions,
  type ImageFormat,
  type RecordAnimationOptions,
} from './capture';

export interface MapExportControlProps
  extends Omit<CaptureOptions, 'format'> {
  /** Still formats offered. Default `['png', 'jpeg']`. */
  formats?: readonly ImageFormat[];
  /**
   * Offer an animated GIF. Supply how many frames there are and how to show
   * each one; omit to offer stills only.
   */
  animation?: Pick<RecordAnimationOptions, 'frameCount' | 'setFrame' | 'delayMs' | 'scale'>;
  /** File name without extension. Default `'map'`. */
  filename?: string;
  /**
   * Receive the file instead of downloading it — to upload it, attach it to a
   * report, or show a preview.
   */
  onExport?: (blob: Blob, filename: string) => void;
  /** Fired when an export fails (most often a CORS-tainted canvas). */
  onError?: (error: Error) => void;
  className?: string;
}

const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <polyline points="7 10 12 15 17 10" />
    <path d="M5 21h14" />
  </svg>
);

const LABELS: Record<ImageFormat, string> = { png: 'PNG image', jpeg: 'JPEG image', webp: 'WebP image' };

/**
 * An export button for `MapControlBar`: PNG, JPEG and — when given an
 * animation — an animated GIF of every frame.
 *
 * ```tsx
 * <MapControlBar>
 *   <MapExportControl
 *     filename="rainfall-2026-10-30"
 *     title="Rainfall · 30 Oct 2026 06Z"
 *     attribution="© OpenStreetMap contributors"
 *     animation={{ frameCount: frames.length, setFrame: showFrame }}
 *   />
 * </MapControlBar>
 * ```
 */
export function MapExportControl({
  formats = ['png', 'jpeg'],
  animation,
  filename = 'map',
  onExport,
  onError,
  className,
  ...capture
}: MapExportControlProps) {
  const { map } = useMap();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const deliver = (blob: Blob, name: string) => {
    if (onExport) onExport(blob, name);
    else downloadBlob(blob, name);
  };

  const run = async (kind: ImageFormat | 'gif') => {
    if (!map || busy) return;
    setOpen(false);
    setBusy(kind);
    setProgress(0);
    try {
      if (kind === 'gif' && animation) {
        const blob = await recordMapAnimation(map, {
          ...capture,
          ...animation,
          onProgress: setProgress,
        });
        deliver(blob, `${filename}.gif`);
      } else if (kind !== 'gif') {
        const blob = await captureMap(map, { ...capture, format: kind });
        deliver(blob, `${filename}.${kind === 'jpeg' ? 'jpg' : kind}`);
      }
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      if (onError) onError(failure);
      else console.error('[gcl] Map export failed:', failure);
    } finally {
      setBusy(null);
    }
  };

  const label = busy
    ? busy === 'gif'
      ? `Recording ${Math.round(progress * 100)}%`
      : 'Exporting…'
    : 'Export map';

  return (
    <div className={cx('gcl-controls__group', className)}>
      <Popover
        side="left"
        align="start"
        open={open}
        onOpenChange={setOpen}
        trigger={
          <span>
            <Tooltip label={label} side="left">
              <Button aria-label={label} disabled={!map || busy !== null} aria-busy={busy !== null}>
                {busy ? <span className="gcl-export__spinner" aria-hidden="true" /> : <DownloadIcon />}
              </Button>
            </Tooltip>
          </span>
        }
      >
        <div className="gcl-export__menu" role="menu" aria-label="Export format">
          {formats.map((format) => (
            <button key={format} type="button" role="menuitem" className="gcl-export__item" onClick={() => void run(format)}>
              {LABELS[format]}
            </button>
          ))}
          {animation && (
            <button type="button" role="menuitem" className="gcl-export__item" onClick={() => void run('gif')}>
              Animated GIF · {animation.frameCount} frames
            </button>
          )}
        </div>
      </Popover>
    </div>
  );
}
