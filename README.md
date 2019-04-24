# cesium-drawing-tool
Tools for drawing points, polylines and polygons on Cesium.js

![cesium drawing tool](https://i.imgur.com/s3iHiTv.jpg)

## APIs

1. `getAll()` - get all drawn shapes
2. `getPoints()` - get all drawn points
3. `getPolylines()` - get all drawn polylines
4. `getPolygons()` - get all drawn polygons

## Dependencies
1. Jquery (version >= 3.3.1)
2. Material icons (version >= 3.0.1)

## How to use

```javascript

let viewer = new Cesium.Viewer('cesiumContainer', {});

let cesiumDrawingTool = new CesiumDrawingTool(
    viewer, // cesium viewer object
    'cesiumContainer', // viewer DOM id
    'your/pin/image' // location pin image uri
);

// activate drawing tool
cesiumDrawingTool.init();

```