// A pan or pinch never becomes a command tap. Mouse handling stays separate.
export class TouchControls {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.pointers = new Map();
    this.multi = false;
    this.gesture = null;
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.move(e));
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("pointercancel", (e) => {
      if (e.pointerType !== "mouse") this.reset();
    });
    canvas.addEventListener("lostpointercapture", (e) => {
      if (this.pointers.has(e.pointerId)) this.reset();
    });
  }
  snapshot() {
    const [a, b] = [...this.pointers.values()];
    return b
      ? {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          distance: Math.hypot(a.x - b.x, a.y - b.y),
        }
      : null;
  }
  down(e) {
    if (e.pointerType === "mouse" || !this.callbacks.enabled()) return;
    e.preventDefault();
    this.callbacks.activate();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    });
    if (this.pointers.size > 1) {
      this.multi = true;
      this.callbacks.rectangle(null);
      this.gesture = this.snapshot();
    }
  }
  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(p.x - p.startX, p.y - p.startY) > 9) p.moved = true;
    if (this.pointers.size > 1) {
      const next = this.snapshot();
      if (next && this.gesture)
        this.callbacks.panZoom(
          next.x - this.gesture.x,
          next.y - this.gesture.y,
          this.gesture.distance / Math.max(10, next.distance),
        );
      this.gesture = next;
    } else if (p.moved) {
      if (this.callbacks.boxMode() && !this.multi) this.callbacks.rectangle(p);
      else this.callbacks.panZoom(dx, dy, 1);
    }
  }
  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    this.pointers.delete(e.pointerId);
    if (this.canvas.hasPointerCapture(e.pointerId))
      this.canvas.releasePointerCapture(e.pointerId);
    if (this.callbacks.enabled() && !this.multi) {
      if (p.moved && this.callbacks.boxMode()) this.callbacks.box(p);
      else if (!p.moved) this.callbacks.tap(e.clientX, e.clientY);
    }
    this.callbacks.rectangle(null);
    this.gesture = this.snapshot();
    if (!this.pointers.size) this.multi = false;
  }
  reset() {
    const ids = [...this.pointers.keys()];
    this.pointers.clear();
    this.multi = false;
    this.gesture = null;
    for (const id of ids)
      if (this.canvas.hasPointerCapture(id))
        this.canvas.releasePointerCapture(id);
    this.callbacks.rectangle(null);
  }
}
