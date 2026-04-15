import { FatalError, RetryableError } from './retry';

export interface UploadGuardInput {
  sourceParagraphs: string[];
  translatedParagraphs: string[];
  expectedGlossaryId?: string;
  uploadGlossaryId?: string;
  oldParagraphsSnapshot?: string[];
}

export class UploadGuard {
  static assertBeforeUpload(input: UploadGuardInput) {
    const {
      sourceParagraphs,
      translatedParagraphs,
      expectedGlossaryId,
      uploadGlossaryId,
      oldParagraphsSnapshot,
    } = input;

    if (sourceParagraphs.length !== translatedParagraphs.length) {
      throw new RetryableError(
        '上传前校验失败：行数不一致',
        'upload-temporary',
      );
    }
    if (translatedParagraphs.some((it) => it === undefined || it === null)) {
      throw new FatalError('上传前校验失败：存在空行对象');
    }
    if (
      expectedGlossaryId !== undefined &&
      uploadGlossaryId !== undefined &&
      expectedGlossaryId !== uploadGlossaryId
    ) {
      throw new RetryableError(
        '上传前校验失败：术语表版本不一致',
        'upload-temporary',
      );
    }
    if (
      oldParagraphsSnapshot &&
      oldParagraphsSnapshot.length > 0 &&
      oldParagraphsSnapshot.length !== sourceParagraphs.length
    ) {
      throw new RetryableError(
        '上传前校验失败：章节快照疑似已变化',
        'upload-temporary',
      );
    }
  }
}
