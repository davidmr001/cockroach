// Copyright 2017 The Cockroach Authors.
//
// Licensed under the Cockroach Community Licence (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/cockroachdb/cockroach/blob/master/licenses/CCL.txt

import _ from "lodash";
import * as vector from "src/util/vector";

// Box is an immutable construct for a box.
export class Box {
  // Compute a minimum bounding box for a supplied collection of boxes.
  static boundingBox(...boxes: Box[]): Box {
    if (_.isEmpty(boxes)) {
      return null;
    }

    let top = Infinity;
    let left = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < boxes.length; i++) {
      top = Math.min(top, boxes[i].top());
      right = Math.max(right, boxes[i].right());
      left = Math.min(left, boxes[i].left());
      bottom = Math.max(bottom, boxes[i].bottom());
    }
    return new Box(left, top, right - left, bottom - top);
  }

  constructor(private x: number, private y: number, private w: number, private h: number) { }

  width() {
    return this.w;
  }

  height() {
    return this.h;
  }

  right() {
    return this.x + this.w;
  }

  left() {
    return this.x;
  }

  top() {
    return this.y;
  }

  bottom() {
    return this.y + this.h;
  }

  origin(): Point {
    return [this.x, this.y];
  }

  size(): Size {
    return [this.w, this.h];
  }

  center(): Point {
    return [this.x + this.w / 2, this.y + this.h / 2];
  }

  scale(scale: number): Box {
    return new Box(this.x, this.y, this.w * scale, this.h * scale);
  }

  translate(vec: Point): Box {
    return new Box(this.x + vec[0], this.y + vec[1], this.w, this.h);
  }
}

// Point is a [number, number] which represents a 2 dimensional vector.
type Point = [number, number];

// Size is a [number, number] which represents a width/height pair.
type Size = [number, number];

export class ZoomTransformer {
  // Bounding box of the scene.
  private _bounds: Box;
  // Size of the viewport.
  private _viewportSize: Size;

  // Current scale of the zoom.
  private _scale: number;
  // Current translation of the zoom.
  private _translate: Point;

  // Construct a new ZoomTransformer for the given bounding box and viewportSize.
  // The area is initially centered over the center of the bounding box.
  constructor(bounds: Box, viewportSize: Size) {
    this._bounds = bounds;
    this._viewportSize = viewportSize;
    this._scale = this.minScale();
    this._translate =  vector.sub(vector.mult(this._viewportSize, 0.5), vector.mult(this._bounds.center(), this._scale));
  }

  minScale() {
    // Increase scaling if we are below the minimum.
    const boundsSize = this._bounds.size();
    return Math.max(
      this._viewportSize[0] / boundsSize[0],
      this._viewportSize[1] / boundsSize[1],
    );
  }

  scale() {
    return this._scale;
  }

  translate() {
    return this._translate;
  }

  viewportSize() {
    return this._viewportSize;
  }

  withViewportSize(viewportSize: Size): ZoomTransformer {
    const newZoom = _.clone(this);
    newZoom._viewportSize = viewportSize;
    newZoom.adjustZoom();
    return newZoom;
  }

  withScaleAndTranslate(scale: number, translate: Point) {
    const newZoom = _.clone(this);
    newZoom._scale = scale;
    newZoom._translate = translate;
    newZoom.adjustZoom();
    return newZoom;
  }

  // zoomedToBoundingBox returns a ZoomTransformer which has been adjusted to
  // exactly fit and center the provided bounding box.
  zoomedToBox(bounding: Box): ZoomTransformer {
    if (_.isNil(bounding)) {
      return this;
    }

    const newZoom = _.clone(this);
    const boundingSize = bounding.size();
    newZoom._scale = Math.min(
      this._viewportSize[0] / boundingSize[0],
      this._viewportSize[1] / boundingSize[1],
    );
    newZoom._translate =  vector.sub(vector.mult(this._viewportSize, 0.5), vector.mult(bounding.center(), newZoom._scale));
    newZoom.adjustZoom();
    return newZoom;
  }

  private adjustZoom() {
    // Increase scaling if we are below the minimum.
    const newScale = Math.max(this._scale, this.minScale());
    const scaledBounds = this._bounds.scale(newScale);
    const newTranslate = _.clone(this._translate);

    // Adjust translation so that viewport is within the bounds.
    const translatedBounds = scaledBounds.translate(this._translate);
    if (this._viewportSize[0] > translatedBounds.right()) {
      // Bounds aligned with right of viewport.
      newTranslate[0] = this._viewportSize[0] - scaledBounds.right();
    } else if (translatedBounds.left() > 0) {
      // Bounds aligned with left of viewport.
      newTranslate[0] = -scaledBounds.left();
    }

    if (this._viewportSize[1] > translatedBounds.bottom()) {
      // Bounds aligned with bottom of viewport.
      newTranslate[1] = this._viewportSize[1] - scaledBounds.bottom();
    } else if (translatedBounds.top() > 0) {
      // Bounds aligned with left of viewport.
      newTranslate[1] = -scaledBounds.top();
    }

    this._scale = newScale;
    this._translate = newTranslate;
  }
}