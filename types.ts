export interface Photo {
  id: string;
  dataUrl: string;
  timestamp: number;
  filter: string;
}

export type FilterType = 'normal' | 'grayscale' | 'sepia' | 'contrast' | 'warm' | 'cool' | 'vintage';

export interface FilterConfig {
  name: string;
  label: string;
  class: string; // CSS class for preview
  cssFilter: string; // CSS filter string for canvas
}
