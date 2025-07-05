const authState = {
  userId: null,
  isAuthenticated: false,
  listeners: [],
  subscribe(fn) {
    this.listeners.push(fn);
    fn({ userId: this.userId, isAuthenticated: this.isAuthenticated });
  },
  update(payload) {
    Object.assign(this, payload);
    this.listeners.forEach(fn =>
      fn({ userId: this.userId, isAuthenticated: this.isAuthenticated })
    );
  }
};

export default authState;
