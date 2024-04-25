class LocalMemState {
  state: Record<string, unknown> = {};
  listeners: Set<() => void> = new Set();

  getState = (key: string) => this.state[key];

  setState = (key: string, payload: unknown) => {
    this.state[key] = payload;
    this.listeners.forEach(l => l());
  };

  subscribe = (func: () => void) => {
    this.listeners.add(func);
    return () => {
      this.listeners.delete(func);
    };
  };

  getSnapshot = () => {
    return { ...this.state };
  };
}

export const localMemState = new LocalMemState();