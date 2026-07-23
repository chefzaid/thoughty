import type { ConfigService } from '@/modules/config';

export async function resolveAiModel(
  configService: ConfigService,
  userId: number,
  defaultModel: string,
  taskConfigKey?: string,
): Promise<string> {
  if (taskConfigKey) {
    const taskModel = await configService.getDecryptedConfig(userId, taskConfigKey);
    if (taskModel) {
      return taskModel;
    }
  }

  const model = await configService.getDecryptedConfig(userId, 'openRouterModel');
  return model || defaultModel;
}
