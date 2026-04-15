import type { Glossary } from '@/model/Glossary';

import type { Logger, SegmentContext, SegmentTranslator } from './Common';
import { createLengthSegmentor } from './Common';
import {
  OpenAiCompatibleAdapter,
  OutputValidator,
  RetryPolicy,
} from './llm-core';

export class DeepSeekTranslator implements SegmentTranslator {
  id = <const>'gpt';
  log: Logger;
  private adapter: OpenAiCompatibleAdapter;
  private temperature: number | undefined;
  private maxTokens: number | undefined;
  private retryPolicy: RetryPolicy;

  constructor(log: Logger, config: DeepSeekTranslator.Config) {
    this.log = log;
    this.adapter = new OpenAiCompatibleAdapter({
      endpoint: config.endpoint || 'https://api.deepseek.com',
      key: config.key,
      model: config.model || 'deepseek-chat',
      timeoutMs: config.timeoutMs,
    });
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.retryPolicy = new RetryPolicy({
      maxAttempts: config.retryCount ?? 4,
      baseDelayMs: 1000,
      maxDelayMs: 30_000,
    });
  }

  segmentor = createLengthSegmentor(1500, 30);

  async translate(
    seg: string[],
    { glossary, signal }: SegmentContext,
  ): Promise<string[]> {
    let lastError: unknown;
    try {
      return await this.retryPolicy.run(
        async (attempt) => {
          this.log(`第${attempt + 1}次`);
          const lines = await this.translateLines(seg, glossary, signal);
          OutputValidator.validateLineCount(lines, seg.length);
          OutputValidator.validateChineseRatio(lines);
          OutputValidator.validateNoDisclaimer(lines);
          this.log(`原文/输出：${seg.length}/${lines.length}行`);
          return lines;
        },
        { signal },
      );
    } catch (error) {
      lastError = error;
    }

    if (seg.length <= 1) {
      throw lastError;
    }

    this.log('连续失败，启动二分翻译');
    return this.binaryTranslate(seg, glossary, signal);
  }

  private async binaryTranslate(
    seg: string[],
    glossary: Glossary,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const recurse = async (left: number, right: number): Promise<string[]> => {
      const part = seg.slice(left, right);
      try {
        return await this.retryPolicy.run(
          async () => {
            const lines = await this.translateLines(part, glossary, signal);
            OutputValidator.validateLineCount(lines, part.length);
            OutputValidator.validateChineseRatio(lines);
            return lines;
          },
          { signal },
        );
      } catch {
        if (right - left <= 1) {
          throw new Error('重试次数太多');
        }
        this.log(`翻译${left + 1}到${right}行失败，继续二分`);
        const mid = Math.floor((left + right) / 2);
        const l = await recurse(left, mid);
        const r = await recurse(mid, right);
        return l.concat(r);
      }
    };

    const mid = Math.floor(seg.length / 2);
    const l = await recurse(0, mid);
    const r = await recurse(mid, seg.length);
    return l.concat(r);
  }

  private async translateLines(
    lines: string[],
    glossary: Glossary,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const messages = buildMessages(lines, glossary);
    const completion = await this.adapter.complete(messages, {
      signal,
      stream: false,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });
    if (completion.content.trim().length === 0) {
      throw new Error('空响应');
    }
    return OutputValidator.parseNumbered(completion.content, lines.length);
  }
}

export namespace DeepSeekTranslator {
  export interface Config {
    endpoint?: string;
    key: string;
    model?: 'deepseek-chat' | 'deepseek-reasoner' | (string & {});
    timeoutMs?: number;
    maxTokens?: number;
    temperature?: number;
    retryCount?: number;
  }
  export const create = (log: Logger, config: Config) =>
    new DeepSeekTranslator(log, config);
}

const buildMessages = (
  lines: string[],
  glossary: Glossary,
): { role: 'user'; content: string }[] => {
  const parts = [
    '你是轻小说翻译器。将以下日文逐行翻译为简体中文。',
    '硬性要求：',
    '1) 严格保留每行开头的 #序号: 格式；',
    '2) 输出行数必须与输入行数完全一致；',
    '3) 不要添加任何解释、免责声明或额外文本；',
    '4) 保持原文语气与换行。',
  ];

  const matchedWordPairs: [string, string][] = [];
  for (const jp in glossary) {
    for (const line of lines) {
      if (line.includes(jp)) {
        matchedWordPairs.push([jp, glossary[jp]]);
        break;
      }
    }
  }
  if (matchedWordPairs.length > 0) {
    parts.push('术语表：');
    for (const [jp, zh] of matchedWordPairs) {
      parts.push(`${jp} => ${zh}`);
    }
  }

  parts.push('原文：');
  lines.forEach((line, i) => parts.push(`#${i + 1}:${line}`));
  if (lines.length === 1) parts.push('原文到此为止');

  return [{ role: 'user', content: parts.join('\n') }];
};
