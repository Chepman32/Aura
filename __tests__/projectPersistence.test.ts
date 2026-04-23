import {
  looksLikeGeneratedProjectPreviewUri,
  restoreProjectFromPersistence,
  serializeProjectForPersistence,
} from '../src/store/projectPersistence';

describe('projectPersistence', () => {
  it('serializes sandbox file uris into a portable form', () => {
    const project = {
      sourceVideoUri: 'file:///documents/imports/source.mov',
      previewUri: 'file:///documents/project-previews/demo.jpg',
    };

    expect(serializeProjectForPersistence(project)).toEqual({
      sourceVideoUri: 'aura-file://documents/imports/source.mov',
      previewUri: 'aura-file://documents/project-previews/demo.jpg',
    });
  });

  it('restores portable and legacy document uris to the current sandbox path', () => {
    expect(
      restoreProjectFromPersistence({
        sourceVideoUri: 'aura-file://documents/imports/source.mov',
        previewUri:
          'file:///private/var/mobile/Containers/Data/Application/OLD/Documents/project-previews/demo.jpg',
      }),
    ).toEqual({
      sourceVideoUri: 'file:///documents/imports/source.mov',
      previewUri: 'file:///documents/project-previews/demo.jpg',
    });
  });

  it('detects generated preview uris across portable and legacy formats', () => {
    expect(
      looksLikeGeneratedProjectPreviewUri(
        'aura-file://documents/project-previews/demo.jpg',
      ),
    ).toBe(true);
    expect(
      looksLikeGeneratedProjectPreviewUri(
        'file:///private/var/mobile/Containers/Data/Application/OLD/Documents/project-previews/demo.jpg',
      ),
    ).toBe(true);
    expect(looksLikeGeneratedProjectPreviewUri('ph://demo')).toBe(false);
  });
});
