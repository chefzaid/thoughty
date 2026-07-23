import { parsePersonalityAssessment } from './personality-analysis';

describe('parsePersonalityAssessment', () => {
  it('normalizes, bounds, and deduplicates valid traits', () => {
    const result = parsePersonalityAssessment(
      JSON.stringify({
        traits: [
          { label: ' Reflective ', score: 130, evidence: 'Planning words recur.' },
          { label: 'reflective', score: 20, evidence: 'Duplicate label.' },
          { label: 'Adaptable', score: '-4', evidence: 'Subjects vary over time.' },
        ],
        summary: ' The writing is reflective and adaptable. ',
      }),
    );

    expect(result).toEqual({
      traits: [
        { label: 'Reflective', score: 100, evidence: 'Planning words recur.' },
        { label: 'Adaptable', score: 0, evidence: 'Subjects vary over time.' },
      ],
      summary: 'The writing is reflective and adaptable.',
    });
  });

  it('extracts JSON from a fenced or prefixed response', () => {
    expect(
      parsePersonalityAssessment(
        'Result:\n```json\n{"traits":[{"label":"Curious","score":72,"evidence":"Learning subjects recur."}],"summary":"Curiosity appears in the writing."}\n```',
      )?.traits[0]?.label,
    ).toBe('Curious');
  });

  it('rejects protected or clinical inferences', () => {
    expect(
      parsePersonalityAssessment(
        JSON.stringify({
          traits: [{ label: 'Political affiliation', score: 50, evidence: 'News words recur.' }],
          summary: 'A political profile.',
        }),
      ),
    ).toBeNull();

    expect(
      parsePersonalityAssessment(
        JSON.stringify({
          traits: [{ label: 'Reflective', score: 50, evidence: 'This suggests a diagnosis.' }],
          summary: 'A reflective profile.',
        }),
      ),
    ).toBeNull();

    expect(
      parsePersonalityAssessment(
        JSON.stringify({
          traits: [
            {
              label: 'Réflexion',
              score: 50,
              evidence: 'Ces mots permettent un diagnostic.',
            },
          ],
          summary: 'Un profil réflexif.',
        }),
      ),
    ).toBeNull();
  });

  it('rejects malformed or incomplete payloads', () => {
    expect(parsePersonalityAssessment('not-json')).toBeNull();
    expect(parsePersonalityAssessment('{"traits":[],"summary":"Empty"}')).toBeNull();
    expect(parsePersonalityAssessment('{"traits":[{"label":"Calm","score":20}]}')).toBeNull();
  });
});
