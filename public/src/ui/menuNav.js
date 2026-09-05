// A small, input-agnostic selectable-list controller for console-style
// menus. Keyboard, mouse, and (later) a gamepad poll loop can all drive the
// same `moveSelection`/`activateSelected` pair without duplicating the
// "what's currently highlighted" logic.
export class MenuNav {
  constructor(items) {
    this.setItems(items);
  }

  setItems(items) {
    this.items = items;
    const firstEnabled = items.findIndex((item) => !item.disabled);
    this.selectedIndex = firstEnabled === -1 ? 0 : firstEnabled;
  }

  moveSelection(delta) {
    if (this.items.length === 0) return;
    let index = this.selectedIndex;
    for (let step = 0; step < this.items.length; step += 1) {
      index = (index + delta + this.items.length) % this.items.length;
      if (!this.items[index].disabled) {
        this.selectedIndex = index;
        break;
      }
    }
  }

  select(index) {
    if (index < 0 || index >= this.items.length) return;
    if (this.items[index].disabled) return;
    this.selectedIndex = index;
  }

  activateSelected() {
    const item = this.items[this.selectedIndex];
    if (item && !item.disabled) item.onActivate();
  }
}
