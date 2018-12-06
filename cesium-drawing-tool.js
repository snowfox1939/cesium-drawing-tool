class CesiumDrawingTool {

    constructor(viewer, elementId, options) {
        this.viewer = viewer;
        this.elementId = elementId;
        this.options = options;
        this.eventHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

        this.points = new Array();
        this.Polylines = new Array();
        this.Polygons = new Array();

        this.mode = null; // null, 'POINT', 'LINE', 'AREA', 'DELETE_ONE'
        this.activeShapePoints = new Array();
        this.activeShape = null;
        this.cursorPoint = null;

        this.text = {
            normal: '選取工具以繪製。',
            point: '滑鼠點擊地圖一處以添加標記，Esc鍵退出編輯。',
            line: '左鍵點擊地圖以添加線段，點擊右鍵以完成圖形，Esc鍵退出。',
            area: '左鍵點擊地圖以繪製多邊形，點擊右鍵以完成圖形，Esc鍵退出',
            deleteOne: '點擊繪圖以刪除',
            deleteOneDone: '已成功刪除繪圖。',
            deleteAllDone: '已成功刪除全部繪圖。'
        };
    }

    init() {

        this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        this.viewer.scene.screenSpaceCameraController.enableTilt = false;

        $('#' + this.elementId).append("<div class='cesium-drawing-tool message'>選取工具以繪製</div>");
        $('#' + this.elementId).append("<div class='cesium-drawing-tool button-container'> \
            <a title='添加標記' class='cesium-drawing-tool button draw-point'><i class='material-icons'>add_location</i></a>\
            <a title='繪製線段' class='cesium-drawing-tool button draw-line'><i class='material-icons'>timeline</i></a>\
            <a title='繪製區域' class='cesium-drawing-tool button draw-area'><i class='material-icons'>texture</i></a>\
            <a title='清除一個繪圖' class='cesium-drawing-tool button remove-one'><i class='material-icons'>clear</i></a>\
            <a title='清除全部繪圖' class='cesium-drawing-tool button remove-all'><i class='material-icons'>delete_sweep</i></a>\
        </div>");

        // register events
        this.eventHandler.setInputAction((function (event) {
            if (!Cesium.Entity.supportsPolylinesOnTerrain(this.viewer.scene)) {
                console.log('This browser does not support polylines on terrain.');
                return;
            }

            var earthPosition = this.viewer.camera.pickEllipsoid(event.position);

            if (Cesium.defined(earthPosition)) {
                if (this.mode == 'LINE' || this.mode == 'AREA') {
                    if (this.activeShapePoints.length === 0) {
                        this.cursorPoint = this.createPoint(earthPosition);
                        this.activeShapePoints.push(earthPosition);
                        var dynamicPositions = new Cesium.CallbackProperty((function () {
                            return this.activeShapePoints;
                        }).bind(this), false);
                        this.activeShape = this.drawShape(dynamicPositions);
                    }
                    this.activeShapePoints.push(earthPosition);
                    // this.createPoint(earthPosition);

                } else if (this.mode == 'POINT') {
                    this.activeShapePoints.push(earthPosition);
                    this.completeShape();
                } else if (this.mode == 'DELETE_ONE') {
                    var pickedFeature = viewer.scene.pick(event.position);
                    if (Cesium.defined(pickedFeature)) {
                        if (pickedFeature.id.fromDrawingTool) {
                            this.removeShape(pickedFeature.id);
                        }
                    }
                }
            }
        }).bind(this), Cesium.ScreenSpaceEventType.LEFT_CLICK);

        this.eventHandler.setInputAction((function (event) {
            if (this.mode == 'LINE' || this.mode == 'AREA') {
                if (Cesium.defined(this.cursorPoint)) {
                    var newPosition = this.viewer.camera.pickEllipsoid(event.endPosition);
                    if (Cesium.defined(newPosition)) {
                        this.cursorPoint.position.setValue(newPosition);
                        this.activeShapePoints.pop();
                        this.activeShapePoints.push(newPosition);
                    }
                }
            } else if (this.mode == 'POINT') {
                var newPosition = this.viewer.camera.pickEllipsoid(event.endPosition);
                if (Cesium.defined(this.cursorPoint)) {
                    this.cursorPoint.position.setValue(newPosition);
                } else {
                    this.cursorPoint = this.viewer.entities.add({
                        position: newPosition,
                        billboard: {
                            image: '/img/map_marker.png',
                            scale: 0.1
                        }
                    });
                }
            }
        }).bind(this), Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.eventHandler.setInputAction((function () {
            if (this.mode == 'LINE' || this.mode == 'AREA') {
                this.completeShape();
            }
        }).bind(this), Cesium.ScreenSpaceEventType.RIGHT_CLICK);

        $('.cesium-drawing-tool.button.draw-point').click((function () { this.addPointMode(); }).bind(this));
        $('.cesium-drawing-tool.button.draw-line').click((function () { this.addPolylineMode(); }).bind(this));
        $('.cesium-drawing-tool.button.draw-area').click((function () { this.addPolygonMode(); }).bind(this));
        $('.cesium-drawing-tool.button.remove-one').click((function () { this.removeMode(); }).bind(this));
        $('.cesium-drawing-tool.button.remove-all').click((function () { this.removeAllShape(); }).bind(this));

        $('body').keydown((function (event) {
            if (event.key == 'Escape') {
                this.cancelEditing({ changeText: true });
            }
        }).bind(this));
    }

    getAll() {
        let entities = this.viewer.entities._entities._array;
        let pool = new Array();

        for (let i = 0; i < entities.length; i++) {
            if (entities[i].fromDrawingTool) {
                pool.push(entities[i]);
            }
        }

        return pool;
    }

    getPoints() {
        let entities = this.viewer.entities._entities._array;
        let pool = new Array();

        for (let i = 0; i < entities.length; i++) {
            if (entities[i].fromDrawingTool && entities[i].mode == 'POINT') {
                pool.push(entities[i]);
            }
        }

        return pool;
    }

    getPolylines() {
        let entities = this.viewer.entities._entities._array;
        let pool = new Array();

        for (let i = 0; i < entities.length; i++) {
            if (entities[i].fromDrawingTool && entities[i].mode == 'LINE') {
                pool.push(entities[i]);
            }
        }

        return pool;
    }

    getPolygons() {
        let entities = this.viewer.entities._entities._array;
        let pool = new Array();

        for (let i = 0; i < entities.length; i++) {
            if (entities[i].fromDrawingTool && entities[i].mode == 'AREA') {
                pool.push(entities[i]);
            }
        }

        return pool;
    }

    addPointMode() {

        if (this.mode == 'POINT') {
            return this.cancelEditing({ changeText: true });
        }

        // clear
        this.cancelEditing();

        this.mode = 'POINT';

        // UI
        $('.cesium-drawing-tool.button.draw-point').addClass('active');
        this.showMessage(this.text.point);
    }

    addPolylineMode() {

        if (this.mode == 'LINE') {
            return this.cancelEditing({ changeText: true });
        }

        // clear
        this.cancelEditing();

        this.mode = 'LINE';

        // UI
        $('.cesium-drawing-tool.button.draw-line').addClass('active');
        this.showMessage(this.text.line);
    }

    addPolygonMode() {

        if (this.mode == 'AREA') {
            return this.cancelEditing({ changeText: true });
        }

        // clear
        this.cancelEditing();

        this.mode = 'AREA';

        // UI
        $('.cesium-drawing-tool.button.draw-area').addClass('active');
        this.showMessage(this.text.area);
    }

    removeMode() {

        if (this.mode == 'DELETE_ONE') {
            return this.cancelEditing({ changeText: true });
        }

        // clear
        this.cancelEditing();

        this.mode = 'DELETE_ONE';

        // UI
        $('.cesium-drawing-tool.button.remove-one').addClass('active');
        this.showMessage(this.text.deleteOne);
    }

    cancelEditing(options) {
        this.viewer.entities.remove(this.cursorPoint);
        this.viewer.entities.remove(this.activeShape);

        this.cursorPoint = null;
        this.activeShape = null;
        this.activeShapePoints = new Array();

        switch (this.mode) {
            case 'POINT':
                $('.cesium-drawing-tool.button.draw-point').removeClass('active');
                break;
            case 'LINE':
                $('.cesium-drawing-tool.button.draw-line').removeClass('active');
                break;
            case 'AREA':
                $('.cesium-drawing-tool.button.draw-area').removeClass('active');
                break;
            case 'DELETE_ONE':
                $('.cesium-drawing-tool.button.remove-one').removeClass('active');
                break;
        }

        if (options && options.changeText) {
            this.showMessage(this.text.normal);
        }

        this.mode = null;
    }

    // helpers
    createPoint(position) {
        let point = this.viewer.entities.add({
            position: position,
            point: {
                color: Cesium.Color.WHITE,
                pixelSize: 5,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        });
        return point;
    }

    drawShape(positions, completed = false) {
        let shape = null;
        if (this.mode == 'POINT') {
            let p;
            if (Array.isArray(positions)) {
                p = positions[0];
            } else {
                p = positions;
            }

            shape = this.viewer.entities.add({
                position: p,
                billboard: {
                    image: '/img/map_marker.png',
                    scale: 0.1
                }
            });
        } else if (this.mode == 'LINE') {
            shape = this.viewer.entities.add({
                polyline: {
                    positions: positions,
                    clampToGround: true,
                    width: 3
                }
            });
        } else if (this.mode == 'AREA') {
            shape = this.viewer.entities.add({
                polygon: {
                    hierarchy: positions,
                    material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE.withAlpha(0.7))
                }
            });
        }

        if (completed) {
            shape.fromDrawingTool = true;
            shape.mode = this.mode;
        }

        return shape;
    }

    completeShape() {

        if (this.mode != 'POINT') {
            this.activeShapePoints.pop();
            this.drawShape(this.activeShapePoints, true);
            this.viewer.entities.remove(this.cursorPoint);
            this.viewer.entities.remove(this.activeShape);

            this.cursorPoint = null;
            this.activeShape = null;
            this.activeShapePoints = new Array();
        } else {
            this.viewer.entities.remove(this.cursorPoint);
            this.drawShape(this.activeShapePoints[0], true);

            this.cursorPoint = null;
            this.activeShapePoints = new Array();
        }
        this.cancelEditing({ changeText: true });
    }

    removeShape(entity) {
        this.viewer.entities.remove(entity);

        this.cancelEditing({changeText: false});
        this.showMessage(this.text.deleteOneDone + this.text.normal);
    }

    removeAllShape() {
        let entities = this.viewer.entities._entities._array;
        for (let i = 0; i < entities.length; i++) {
            if (entities[i].fromDrawingTool) {
                this.viewer.entities.remove(entities[i]);
                i -= 1;
            }
        }

        this.cancelEditing({changeText: false});
        this.showMessage(this.text.deleteAllDone + this.text.normal);
    }

    getTerrainHeight(latitude, longitude, callback) {

        let terrainProvider = this.viewer.terrainProvider;
        let positions = [
            Cesium.Cartographic.fromDegrees(longitude, latitude),
        ];
        let promise = Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
        Cesium.when(promise, function (updatedPositions) {
            callback(updatedPositions[0].height);
        });
    }

    showMessage(string) {
        $('.cesium-drawing-tool.message').text(string);
    }
}