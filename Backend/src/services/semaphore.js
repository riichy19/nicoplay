class Semaphore {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.active < this.limit) {
      this.active += 1;
      return this.release.bind(this);
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve(this.release.bind(this));
      });
    });
  }

  release() {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

module.exports = { Semaphore };
