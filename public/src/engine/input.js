export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this.attackPressed = false;

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') this.attackPressed = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    });
    canvas.addEventListener('mousedown', () => {
      this.mouse.down = true;
      this.attackPressed = true;
    });
    window.addEventListener('mouseup', () => (this.mouse.down = false));
  }

  axis() {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len, moving: dx !== 0 || dy !== 0 };
  }

  consumeAttackPress() {
    const wasPressed = this.attackPressed;
    this.attackPressed = false;
    return wasPressed;
  }
}
