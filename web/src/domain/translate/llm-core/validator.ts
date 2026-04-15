import { RegexUtil } from '@/util';

import { RetryableError } from './retry';

const stripPrefix = (line: string, index: number) =>
  line
    .replace(new RegExp(`^#${index + 1}[：:]`), '')
    .replace(new RegExp(`^${index + 1}[：:]`), '')
    .trim();

export class OutputValidator {
  static parseNumbered(content: string, expectedLines: number): string[] {
    const rawLines = content
      .split('\n')
      .map((it) => it.trim())
      .filter(Boolean);

    if (rawLines.length === 0) {
      return [];
    }

    const strict = rawLines
      .filter((it) => /^#?\d+[：:]/.test(it))
      .map((it, i) => stripPrefix(it, i));
    if (strict.length === expectedLines) {
      return strict;
    }

    return rawLines.map((it, i) => stripPrefix(it, i));
  }

  static validateLineCount(output: string[], expectedLines: number) {
    if (output.length !== expectedLines) {
      throw new RetryableError('输出行数不匹配', 'output-invalid');
    }
  }

  static validateChineseRatio(output: string[]) {
    const text = output.join(' ').replace(/(https?:\/\/[^\s]+)/g, '');
    if (!text.trim()) {
      throw new RetryableError('输出为空', 'output-invalid');
    }
    let zh = 0;
    let jp = 0;
    let en = 0;
    const reChinese =
      /[:|#| |0-9|\u4e00-\u9fa5|\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]/;
    for (const c of text) {
      if (reChinese.test(c)) {
        zh++;
      } else if (RegexUtil.hasKanaChars(c)) {
        jp++;
      } else if (RegexUtil.hasEnglishChars(c)) {
        en++;
      }
    }
    const pZh = zh / text.length;
    const pJp = jp / text.length;
    const pEn = en / text.length;
    const maybeChinese =
      pZh > 0.75 || (pZh > pJp && pZh > pEn * 2 && pJp < 0.1);
    if (!maybeChinese) {
      throw new RetryableError('输出语言不是中文', 'output-invalid');
    }
  }

  static validateNoDisclaimer(output: string[]) {
    const text = output.join('\n');
    if (
      /作为.?AI|不能提供|我无法|抱歉|免责声明|对不起，我不能|I can('|’)t/i.test(
        text,
      )
    ) {
      throw new RetryableError('输出含说明性污染文本', 'output-invalid');
    }
  }
}
