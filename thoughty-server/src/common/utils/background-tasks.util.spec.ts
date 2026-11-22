import { BackgroundTasks } from './background-tasks.util';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('BackgroundTasks', () => {
  it('settles at once with nothing in flight', async () => {
    await expect(new BackgroundTasks().settled()).resolves.toBeUndefined();
  });

  it('waits for every task, including one started while it waits', async () => {
    const tasks = new BackgroundTasks();
    const first = deferred();
    const second = deferred();
    tasks.run(first.promise);

    let settled = false;
    const settling = tasks.settled().then(() => (settled = true));
    first.resolve();
    tasks.run(second.promise);
    await flush();
    expect(settled).toBe(false);

    second.resolve();
    await settling;
    expect(settled).toBe(true);
  });

  it('never rejects, even when a task does', async () => {
    const tasks = new BackgroundTasks();
    const failing = deferred();
    tasks.run(failing.promise);

    const settling = tasks.settled();
    failing.reject(new Error('mail server down'));

    await expect(settling).resolves.toBeUndefined();
    await expect(tasks.settled()).resolves.toBeUndefined();
  });
});
