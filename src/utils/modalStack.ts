type CloseModalFn = () => void;

class ModalManager {
  private stack: CloseModalFn[] = [];

  open(closeFn: CloseModalFn) {
    this.stack.push(closeFn);
  }

  close(closeFn: CloseModalFn) {
    const idx = this.stack.indexOf(closeFn);
    if (idx !== -1) this.stack.splice(idx, 1);
  }

  hasOpenModal(): boolean {
    return this.stack.length > 0;
  }

  closeTopModal() {
    const closeFn = this.stack.pop();
    if (closeFn) closeFn();
  }

  reset() {
    this.stack = [];
  }
}

export const modalManager = new ModalManager();

function radixModalOpen(): boolean {
  return (
    document.querySelector('[role="dialog"][data-state="open"]') !== null ||
    document.querySelector('[role="alertdialog"][data-state="open"]') !== null
  );
}

export function hasOpenModal(): boolean {
  return modalManager.hasOpenModal() || radixModalOpen();
}

export function dismissTopModal() {
  if (modalManager.hasOpenModal()) {
    modalManager.closeTopModal();
  } else if (radixModalOpen()) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }
}
