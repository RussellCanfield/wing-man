class LocalMemState {
  state: Record<string, unknown> = {};
  savedState = this.state;
  listeners: Set<() => void> = new Set();

  getState = (key: string) => this.state[key];

  setState = (key: string, payload: unknown) => {
    this.state[key] = payload;
    this.savedState = { ...this.state };
    this.listeners.forEach(l => l());
  };

  subscribe = (func: () => void) => {
    this.listeners.add(func);
    return () => {
      this.listeners.delete(func);
    };
  };

  getSnapshot = () => {
    return this.savedState;
  };
}

export const localMemState = new LocalMemState();