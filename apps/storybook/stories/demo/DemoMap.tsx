import type { ReactNode } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import { MapContainer, type MapContainerProps } from '@hridayanp/map-container';
import { DEMO_BASEMAP, DEMO_CENTER } from './data';

export interface DemoMapProps extends Omit<MapContainerProps, 'children'> {
  /** Explanatory line rendered above the map. */
  note?: ReactNode;
  size?: 'short' | 'default' | 'tall';
  children?: ReactNode;
}

/**
 * The map frame shared by every story.
 *
 * It supplies the container sizing, the demonstration basemap and a default
 * camera, so each story's source shows only the component under documentation.
 * Individual stories override `center`, `zoom` and `mapStyle` where the dataset
 * being rendered requires a different view.
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

/** A plain surface for stories documenting components that require no map. */
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
