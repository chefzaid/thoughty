import { AccountActivityService } from './account-activity.service';

/** An `AccountActivityService` that records nothing, for specs of the services and controllers that call it. */
export function createAccountActivityMock() {
  return {
    record: jest.fn().mockResolvedValue(undefined),
    recordSignIn: jest.fn().mockResolvedValue(undefined),
    list: jest.fn(),
    listForDownload: jest.fn().mockResolvedValue([]),
    newBrowserEmailEnabled: jest.fn().mockResolvedValue(true),
    setNewBrowserEmail: jest.fn(),
    purgeExpired: jest.fn().mockResolvedValue(0),
  };
}

export type AccountActivityMock = ReturnType<typeof createAccountActivityMock>;

/** The mock as a Nest provider of `AccountActivityService`. */
export function accountActivityProvider(mock: AccountActivityMock = createAccountActivityMock()) {
  return { provide: AccountActivityService, useValue: mock };
}
