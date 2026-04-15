import { WenkuNovelApi, formatError } from '@/api';
import type {
  TranslateTaskCallback,
  TranslateTaskParams,
  WenkuTranslateTask,
  WenkuTranslateTaskDesc,
} from '@/model/Translator';

import type { Translator } from './Translator';
import { RetryPolicy, UploadGuard } from './llm-core';

export const translateWenku = async (
  { novelId, volumeId }: WenkuTranslateTaskDesc,
  { level }: TranslateTaskParams,
  callback: TranslateTaskCallback,
  translator: Translator,
  signal?: AbortSignal,
) => {
  const retryPolicy = new RetryPolicy({
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10_000,
  });
  const {
    getTranslateTask,
    getChapterTranslateTask,
    updateChapterTranslation,
  } = WenkuNovelApi.createTranslationApi(
    novelId,
    volumeId,
    translator.id,
    signal,
  );

  // Task
  let task: WenkuTranslateTask;
  try {
    callback.log(`获取未翻译章节 ${volumeId}`);
    task = await retryPolicy.run(
      async (attempt) => {
        if (attempt > 0) {
          callback.log(`获取未翻译章节-重试${attempt + 1}`);
        }
        return getTranslateTask();
      },
      { signal },
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      callback.log(`中止翻译任务`);
      return 'abort';
    } else {
      callback.log(`发生错误，结束翻译任务：${e}`);
      return;
    }
  }

  const chapters = task.toc
    .filter(({ chapterId }) => chapterId !== undefined)
    .map(({ chapterId, glossaryId }, index) => ({
      index,
      chapterId: chapterId!,
      glossaryId,
    }))
    .filter(({ glossaryId }) => {
      if (level === 'normal') {
        return glossaryId === undefined;
      } else if (level === 'expire') {
        return glossaryId === undefined || glossaryId !== task.glossaryId;
      } else {
        return true;
      }
    });

  callback.onStart(chapters.length);
  if (chapters.length === 0) {
    callback.log(`没有需要更新的章节`);
  }

  const forceSeg = level === 'all';
  for (const { index, chapterId } of chapters) {
    try {
      callback.log(`\n[${index}] ${volumeId}/${chapterId}`);
      const cTask = await getChapterTranslateTask(chapterId);

      if (!forceSeg && cTask.glossaryId === cTask.oldGlossaryId) {
        callback.log(`无需翻译`);
        callback.onChapterSuccess({});
      } else {
        const textsZh = await translator.translate(cTask.paragraphJp, {
          glossary: cTask.glossary,
          oldTextZh: cTask.oldParagraphZh,
          oldGlossary: cTask.oldGlossary,
          force: forceSeg,
          signal,
        });
        callback.log('上传章节');
        UploadGuard.assertBeforeUpload({
          sourceParagraphs: cTask.paragraphJp,
          translatedParagraphs: textsZh,
          expectedGlossaryId: cTask.glossaryId,
          uploadGlossaryId: cTask.glossaryId,
          oldParagraphsSnapshot: cTask.oldParagraphZh,
        });
        const state = await retryPolicy.run(
          async (attempt) => {
            if (attempt > 0) {
              callback.log(`上传章节-重试${attempt + 1}`);
            }
            return updateChapterTranslation(chapterId, {
              glossaryId: cTask.glossaryId,
              paragraphsZh: textsZh,
            });
          },
          { signal },
        );
        callback.onChapterSuccess({ zh: state });
      }
    } catch (e) {
      if (e === 'quit') {
        callback.log(`发生错误，结束翻译任务`);
        return;
      } else if (e instanceof DOMException && e.name === 'AbortError') {
        callback.log(`中止翻译任务`);
        return 'abort';
      } else {
        callback.log(`发生错误，跳过：${await formatError(e)}`);
        callback.onChapterFailure();
      }
    }
  }
};
