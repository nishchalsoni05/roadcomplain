export const EVENT_TYPE_LABELS = {
  pothole: 'Pothole',
  road_damage: 'Road Damage',
  waterlogging: 'Waterlogging',
  vehicle: 'Vehicle',
  pedestrian: 'Pedestrian',
  rash_driving: 'Rash Driving',
  missing_signage: 'Missing Signage',
  damaged_signboard: 'Damaged Signboard',
  damaged_divider: 'Damaged Divider',
  missing_zebra: 'Missing Zebra Crossing',
  license_plate: 'License Plate',
  traffic_bottleneck: 'Traffic Bottleneck',
  pedestrian_risk: 'Pedestrian Risk',
  waterlogged_pothole: 'Waterlogged Pothole',
  close_call: 'Close Call',
}

export const EVENT_TYPE_COLORS = {
  waterlogged_pothole: 'blue',
  pothole: 'red',
  road_damage: 'brown',
  waterlogging: 'blue',
  vehicle: '#7C3AED',
  pedestrian: '#059669',
  rash_driving: '#DC2626',
  close_call: 'orange',
  missing_signage: '#D97706',
  damaged_signboard: '#D97706',
  damaged_divider: '#92400E',
  missing_zebra: '#B45309',
  license_plate: '#6366F1',
  traffic_bottleneck: '#6366F1',
  pedestrian_risk: 'green',
}

export const SEVERITY_COLORS = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#D97706',
  low: '#16A34A',
}

export const SOURCE_TYPES = {
  phone_camera: 'Phone Camera',
  webcam: 'Webcam',
  ip_camera: 'IP Camera',
  uploaded_video: 'Uploaded Video',
}

export const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: 'LayoutDashboard' },
  { path: '/detect', label: 'Live Detection', icon: 'Camera' },
  { path: '/map', label: 'GIS Command Map', icon: 'Map' },
  { path: '/incidents', label: 'Incident Analysis', icon: 'FileSearch' },
  { path: '/history', label: 'Test History', icon: 'History' },
  { path: '/analytics', label: 'Analytics', icon: 'BarChart3' },
  { path: '/settings', label: 'Settings', icon: 'Settings' },
]
