import { AccountActivityController } from './account-activity.controller';
import { createAccountActivityMock } from './account-activity.test-helpers';

describe('AccountActivityController', () => {
  const user = { userId: 7, email: 'writer@example.com', username: 'writer' };

  it('lists the signed-in writer’s activity from the page asked for', async () => {
    const activity = createAccountActivityMock();
    const page = { events: [], nextBefore: null, newBrowserEmail: true };
    activity.list.mockResolvedValue(page);
    const controller = new AccountActivityController(activity as never);

    await expect(controller.list(user, { before: 40 })).resolves.toBe(page);
    expect(activity.list).toHaveBeenCalledWith(7, 40);
  });

  it('turns the new-browser email on or off for the signed-in writer', async () => {
    const activity = createAccountActivityMock();
    activity.setNewBrowserEmail.mockResolvedValue(false);
    const controller = new AccountActivityController(activity as never);

    await expect(controller.setNewBrowserEmail(user, { enabled: false })).resolves.toEqual({ newBrowserEmail: false });
    expect(activity.setNewBrowserEmail).toHaveBeenCalledWith(7, false);
  });
});
