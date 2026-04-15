import type { Options } from 'ky';

import { createOpenAiApi } from '@/api';

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface LlmAdapter {
  complete(
    messages: LlmMessage[],
    options?: {
      signal?: AbortSignal;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    },
  ): Promise<{ content: string; finishReason?: string | null }>;
}

export class OpenAiCompatibleAdapter implements LlmAdapter {
  private api: ReturnType<typeof createOpenAiApi>;
  private model: string;
  private timeoutMs: number;

  constructor({
    endpoint,
    key,
    model,
    timeoutMs = 600_000,
  }: {
    endpoint: string;
    key: string;
    model: string;
    timeoutMs?: number;
  }) {
    this.api = createOpenAiApi(endpoint, key);
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async complete(
    messages: LlmMessage[],
    options?: {
      signal?: AbortSignal;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    },
  ) {
    const payload = {
      model: this.model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    };
    const requestOptions: Options = {
      signal: options?.signal,
      timeout: this.timeoutMs,
    };

    if (options?.stream) {
      try {
        const completionStream = await this.api.createChatCompletionsStream(
          {
            ...payload,
            stream: true,
          },
          requestOptions,
        );
        let content = '';
        let finishReason: string | null | undefined = null;
        for (const chunk of completionStream) {
          const choice = chunk.choices[0];
          content += choice?.delta?.content ?? '';
          if (choice?.finish_reason != null) {
            finishReason = choice.finish_reason;
          }
        }
        return { content, finishReason };
      } catch (error) {
        throw new Error(`stream completion failed: ${error}`);
      }
    }

    const completion = await this.api.createChatCompletions(
      {
        ...payload,
        stream: false,
      },
      requestOptions,
    );
    const choice = completion.choices[0];
    return {
      content: choice?.message?.content ?? '',
      finishReason: choice?.finish_reason,
    };
  }
}
