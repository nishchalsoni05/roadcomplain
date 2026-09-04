import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

export default function HeatmapLayer({ points, options }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !points || points.length === 0) return

    // Points should be an array of [lat, lng, intensity]
    const heatLayer = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      },
      ...options
    }).addTo(map)

    return () => {
      map.removeLayer(heatLayer)
    }
  }, [map, points, options])

  return null
}
