export type MapCoords = {
  lat: number;
  lng: number;
};

export type MapMarker = {
  id: string | number;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  tooltip?: string;
};

export type MapPickerProps = {
  initial?: MapCoords | null;
  height?: number;
  readOnly?: boolean;
  showMyLocation?: boolean;
  onChange?: (coords: MapCoords) => void;
  onConfirm?: (coords: MapCoords) => void;
};

export type StaticMapProps = {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
  zoom?: number;
};

export type LiveMapProps = {
  markers: MapMarker[];
  height?: number;
  fitBounds?: boolean;
};