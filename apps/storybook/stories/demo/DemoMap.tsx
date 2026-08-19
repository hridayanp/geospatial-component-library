import type { ReactNode } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import { MapContainer, type MapContainerProps } from '@hridayanp/map-container';
import { DEMO_BASEMAP, DEMO_CENTER } from './data';

export interface DemoMapProps extends Omit<MapContainerProps, 'children'> {
  /** Explanatory line shown above the map. */
  note?: ReactNode;
  size?: 'short' | 'default' | 'tall';
  children?: ReactNode;
}

/**
 * The map frame used by every story.
 *
 * It exists only to keep the stories themselves focused on the component being
 * documented — the sizing, the basemap and the default camera are noise
 * repeated twenty times otherwise.
 */
export function DemoMap({
  note,
  size = 'default',
  center = DEMO_CENTER,
  zoom = 5.6,
  mapStyle = DEMO_BASEMAP as unknown as StyleSpecification,
  children,
  ...rest
}: DemoMapProps) {
  return (
    <div>
      {note && <p className="demo-note">{note}</p>}
      <div
        className={`demo-map${size === 'tall' ? ' demo-map--tall' : size === 'short' ? ' demo-map--short' : ''}`}
      >
        <MapContainer center={center} zoom={zoom} mapStyle={mapStyle} {...rest}>
          {children}
        </MapContainer>
      </div>
    </div>
  );
}

/** A plain panel for stories that document something other than a map. */
export function DemoSurface({
  note,
  children,
}: {
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="demo-surface">
      {note && <p className="demo-note">{note}</p>}
      {children}
    </div>
  );
}
