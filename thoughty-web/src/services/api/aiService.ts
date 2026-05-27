import { safeJsonParse } from './base';

export const createAiService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => {
  const suggestTags = async (
    content: string,
    existingTags: string[] = [],
    maxTags = 5,
  ): Promise<string[] | null> => {
    try {
      const response = await authFetch('/api/ai/suggest-tags', {
        method: 'POST',
        body: JSON.stringify({ content, existingTags, maxTags }),
      });

      const data = await safeJsonParse<{ tags?: string[] }>(response);
      if (!response.ok || !data) {
        return null;
      }

      return Array.isArray(data.tags) ? data.tags : [];
    } catch (error) {
      console.error('Error suggesting tags:', error);
      return null;
    }
  };

  const fixWriting = async (content: string): Promise<string | null> => {
    try {
      const response = await authFetch('/api/ai/fix-writing', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });

      const data = await safeJsonParse<{ content?: string }>(response);
      if (!response.ok || !data) {
        return null;
      }

      return typeof data.content === 'string' ? data.content : null;
    } catch (error) {
      console.error('Error fixing writing:', error);
      return null;
    }
  };

  const chat = async (
    entryId: number,
    entryContent: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<string | null> => {
    try {
      const response = await authFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ entryId, entryContent, messages }),
      });

      const data = await safeJsonParse<{ reply?: string }>(response);
      if (!response.ok || !data) {
        return null;
      }

      return typeof data.reply === 'string' ? data.reply : null;
    } catch (error) {
      console.error('Error in AI chat:', error);
      return null;
    }
  };

  const getChatHistory = async (
    entryId: number,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> => {
    try {
      const response = await authFetch(`/api/ai/history/${entryId}`);
      const data = await safeJsonParse<{ messages?: Array<{ role?: string; content?: string }> }>(response);

      if (!response.ok || !data || !Array.isArray(data.messages)) {
        return [];
      }

      return data.messages.filter((message): message is { role: 'user' | 'assistant'; content: string } => (
        typeof message === 'object'
        && message !== null
        && (message.role === 'user' || message.role === 'assistant')
        && typeof message.content === 'string'
      ));
    } catch (error) {
      console.error('Error loading AI chat history:', error);
      return [];
    }
  };

  const fetchModels = async (): Promise<{ id: string; name: string }[]> => {
    try {
      const response = await authFetch('/api/ai/models');
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  };

  return { suggestTags, fixWriting, chat, getChatHistory, fetchModels };
};