import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CloudSyncService } from './cloud-sync.service';
import { Setting } from '@/database/entities';
import { IoService } from '@/modules/io/io.service';
import { GoogleDriveProvider } from './providers/google-drive.provider';
import { OneDriveProvider } from './providers/onedrive.provider';
import { DropboxProvider } from './providers/dropbox.provider';

function createProviderMock() {
  return {
    getAuthUrl: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true),
    exchangeCode: jest.fn(),
    refreshAccessToken: jest.fn(),
    listFiles: jest.fn(),
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
  };
}

/**
 * A fresh `CloudSyncService` over a settings repository mock, an `IoService` mock and one mock per
 * storage provider, returned with them. The service's error and warning logs are silenced.
 */
export async function createCloudSyncTestBed() {
  const settingRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  };
  const ioService = { export: jest.fn() };
  const googleDriveProvider = createProviderMock();
  const oneDriveProvider = createProviderMock();
  const dropboxProvider = createProviderMock();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CloudSyncService,
      { provide: getRepositoryToken(Setting), useValue: settingRepository },
      { provide: IoService, useValue: ioService },
      { provide: GoogleDriveProvider, useValue: googleDriveProvider },
      { provide: OneDriveProvider, useValue: oneDriveProvider },
      { provide: DropboxProvider, useValue: dropboxProvider },
    ],
  }).compile();

  const service = module.get<CloudSyncService>(CloudSyncService);
  const { logger } = service as unknown as { logger: { error: () => void; warn: () => void } };
  jest.spyOn(logger, 'error').mockImplementation();
  jest.spyOn(logger, 'warn').mockImplementation();

  return { service, settingRepository, ioService, googleDriveProvider, oneDriveProvider, dropboxProvider };
}
