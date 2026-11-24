import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LOCAL_MODEL_PROMPTS_WEB_PATH, renderLocalModelPromptsModule } from '../src/modules/ai/local-model-prompts';

const outputPath = join(process.cwd(), LOCAL_MODEL_PROMPTS_WEB_PATH);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderLocalModelPromptsModule());
console.log(`Local model prompts written to ${outputPath}`);
