import { FONT_FILES, fontFamilyFor } from '../fonts';

describe('fontFamilyFor', () => {
  it('sets titles and headings in Fraunces', () => {
    expect(fontFamilyFor('display', undefined)).toBe('Fraunces_600SemiBold');
    expect(fontFamilyFor('title', undefined)).toBe('Fraunces_600SemiBold');
    expect(fontFamilyFor('heading', '600')).toBe('Fraunces_600SemiBold');
  });

  it('sets everything else in Inter, semibold where the style asks for weight', () => {
    expect(fontFamilyFor('body', undefined)).toBe('Inter_400Regular');
    expect(fontFamilyFor('caption', '400')).toBe('Inter_400Regular');
    expect(fontFamilyFor('bodyStrong', '600')).toBe('Inter_600SemiBold');
    expect(fontFamilyFor('label', '600')).toBe('Inter_600SemiBold');
    expect(fontFamilyFor('body', '700')).toBe('Inter_600SemiBold');
    expect(fontFamilyFor('body', 'bold')).toBe('Inter_600SemiBold');
  });

  it('loads only the files it names', () => {
    expect(Object.keys(FONT_FILES).sort()).toEqual(['Fraunces_500Medium', 'Fraunces_600SemiBold', 'Inter_400Regular', 'Inter_600SemiBold']);
  });
});
