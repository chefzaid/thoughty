import { Injectable } from '@nestjs/common';
import type { Entry } from '@/database/entities';
import { AiService } from '@/modules/ai';

@Injectable()
export class StatsJournalAnalysisService {
  constructor(private readonly aiService: AiService) {}

  async analyze(userId: number, recentEntries: Pick<Entry, 'id' | 'content' | 'date' | 'tags'>[]) {
    return this.aiService.analyzeJournal(userId, recentEntries);
  }
}
