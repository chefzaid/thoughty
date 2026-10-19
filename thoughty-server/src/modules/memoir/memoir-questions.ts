export type MemoirLanguage = 'en' | 'fr';

export interface LocalizedText {
  readonly en: string;
  readonly fr: string;
}

export interface MemoirQuestion {
  readonly id: string;
  readonly chapterId: string;
  readonly text: LocalizedText;
}

export interface MemoirChapter {
  readonly id: string;
  readonly title: LocalizedText;
  readonly questions: readonly MemoirQuestion[];
}

type QuestionSeed = readonly [id: string, en: string, fr: string];

function chapter(id: string, title: LocalizedText, seeds: readonly QuestionSeed[]): MemoirChapter {
  return {
    id,
    title,
    questions: seeds.map(([questionId, en, fr]) => ({ id: questionId, chapterId: id, text: { en, fr } })),
  };
}

/**
 * The guided memoir: a year of weekly questions, ordered as a life story so that
 * chapters (one tag each) read in order when the memoir diary becomes a book.
 */
export const MEMOIR_CHAPTERS: readonly MemoirChapter[] = [
  chapter('childhood', { en: 'Childhood', fr: 'Enfance' }, [
    ['childhood-home', 'What did the home you grew up in look, sound, and smell like?', 'À quoi ressemblait la maison de votre enfance : ses pièces, ses bruits, ses odeurs ?'],
    ['childhood-earliest-memory', 'What is your earliest memory, and why do you think it stayed with you?', 'Quel est votre plus ancien souvenir, et pourquoi est-il resté gravé selon vous ?'],
    ['childhood-play', 'What games did you play as a child, and who did you play them with?', 'À quels jeux jouiez-vous enfant, et avec qui ?'],
    ['childhood-adult', 'Which adult outside your family left a mark on your childhood?', 'Quel adulte en dehors de votre famille a marqué votre enfance ?'],
    ['childhood-meals', 'Which meals or special dishes take you back to your childhood?', 'Quels repas ou plats particuliers vous ramènent à votre enfance ?'],
    ['childhood-trouble', 'Tell the story of a time you got into trouble as a child.', 'Racontez une bêtise d’enfance qui vous a valu des ennuis.'],
    ['childhood-dream', 'What did you want to be when you grew up, and why?', 'Quel métier rêviez-vous de faire plus tard, et pourquoi ?'],
    ['childhood-holidays', 'How did your family celebrate holidays and special occasions?', 'Comment votre famille célébrait-elle les fêtes et les grandes occasions ?'],
  ]),
  chapter('growing-up', { en: 'Growing up', fr: 'Jeunesse' }, [
    ['youth-school', 'What was school like for you, and which teacher do you remember most?', 'Comment viviez-vous l’école, et de quel professeur vous souvenez-vous le plus ?'],
    ['youth-friends', 'Who were your closest friends as a teenager, and what did you do together?', 'Qui étaient vos amis les plus proches à l’adolescence, et que faisiez-vous ensemble ?'],
    ['youth-culture', 'Which music, books, or films shaped you when you were young?', 'Quels musiques, livres ou films ont compté dans votre jeunesse ?'],
    ['youth-rebellion', 'Which rule did you break growing up, or what did you push back against?', 'Quelle règle avez-vous enfreinte en grandissant, ou contre quoi avez-vous protesté ?'],
    ['youth-first-earnings', 'What was the first money you earned, and what did you do with it?', 'Quel a été votre premier argent gagné, et qu’en avez-vous fait ?'],
    ['youth-leaving-home', 'When and how did you leave home, and how did it feel?', 'Quand et comment avez-vous quitté la maison familiale, et qu’avez-vous ressenti ?'],
    ['youth-adulthood', 'When did you first feel like an adult?', 'À quel moment avez-vous eu le sentiment d’être adulte pour la première fois ?'],
  ]),
  chapter('family', { en: 'Family', fr: 'Famille' }, [
    ['family-parents', 'What were your parents like, and what did you learn from each of them?', 'Comment étaient vos parents, et qu’avez-vous appris de chacun d’eux ?'],
    ['family-grandparents', 'What do you know about your grandparents and where they came from?', 'Que savez-vous de vos grands-parents et de leurs origines ?'],
    ['family-siblings', 'Describe your bond with your brothers and sisters, or the children you grew up with.', 'Décrivez le lien avec vos frères et sœurs, ou avec les enfants auprès de qui vous avez grandi.'],
    ['family-story', 'Which story gets told again and again at family gatherings?', 'Quelle histoire est racontée encore et encore lors des réunions de famille ?'],
    ['family-traditions', 'Which family traditions have you kept, changed, or let go?', 'Quelles traditions familiales avez-vous gardées, transformées ou abandonnées ?'],
    ['family-raising-children', 'If you raised children or helped raise them, what surprised you most?', 'Si vous avez élevé des enfants, ou aidé à les élever, qu’est-ce qui vous a le plus surpris ?'],
    ['family-hard-times', 'How did your family get through a difficult time?', 'Comment votre famille a-t-elle traversé une période difficile ?'],
    ['family-heirloom', 'Is there an object passed down in your family? What is its story?', 'Un objet se transmet-il dans votre famille ? Quelle est son histoire ?'],
  ]),
  chapter('love', { en: 'Love and friendship', fr: 'Amour et amitié' }, [
    ['love-first', 'Tell the story of your first love.', 'Racontez l’histoire de votre premier amour.'],
    ['love-partner', 'How did you meet the person who has mattered most in your life?', 'Comment avez-vous rencontré la personne qui a le plus compté dans votre vie ?'],
    ['love-lasting-friendship', 'Which friendship has lasted longest, and what has kept it alive?', 'Quelle amitié a duré le plus longtemps, et qu’est-ce qui l’a fait durer ?'],
    ['love-lost-touch', 'Who do you wish you had stayed in touch with?', 'Avec qui auriez-vous aimé rester en contact ?'],
    ['love-kindness', 'What is the kindest thing someone has ever done for you?', 'Quelle est la plus grande gentillesse que l’on vous ait faite ?'],
    ['love-heartbreak', 'What did a heartbreak or a falling-out teach you?', 'Qu’est-ce qu’une rupture ou une brouille vous a appris ?'],
    ['love-advice', 'What do you know now about love that you wish you had known at twenty?', 'Que savez-vous aujourd’hui de l’amour que vous auriez aimé savoir à vingt ans ?'],
  ]),
  chapter('work', { en: 'Work', fr: 'Travail' }, [
    ['work-path', 'How did you come to do the work you did for most of your life?', 'Comment avez-vous trouvé le métier que vous avez exercé la plus grande partie de votre vie ?'],
    ['work-proudest', 'Which piece of work are you proudest of?', 'De quel travail tirez-vous le plus de fierté ?'],
    ['work-mentor', 'Who taught you the most at work?', 'Qui vous a le plus appris dans votre travail ?'],
    ['work-typical-day', 'Describe an ordinary working day at the job you remember best.', 'Décrivez une journée de travail ordinaire dans l’emploi dont vous vous souvenez le mieux.'],
    ['work-setback', 'Tell the story of a professional setback and what came after it.', 'Racontez un échec professionnel et ce qui a suivi.'],
    ['work-colleague', 'Which colleague do you still think about, and why?', 'À quel collègue pensez-vous encore, et pourquoi ?'],
    ['work-change', 'How did your field change over the years you worked in it?', 'Comment votre domaine a-t-il évolué au fil des années où vous y avez travaillé ?'],
    ['work-advice', 'What would you tell someone starting out in your line of work?', 'Que diriez-vous à quelqu’un qui débute dans votre métier ?'],
  ]),
  chapter('places', { en: 'Places', fr: 'Lieux' }, [
    ['places-hometown', 'What was your town or neighborhood like back then, and how has it changed?', 'Comment était votre ville ou votre quartier à l’époque, et comment a-t-il changé ?'],
    ['places-homes', 'List the places you have lived. Which one felt most like home?', 'Énumérez les endroits où vous avez vécu. Lequel vous a le plus donné le sentiment d’être chez vous ?'],
    ['places-journey', 'Which journey changed the way you saw the world?', 'Quel voyage a changé votre regard sur le monde ?'],
    ['places-peace', 'Where do you go, or wish you could go, to feel at peace?', 'Où allez-vous, ou aimeriez-vous aller, pour trouver la paix ?'],
    ['places-move', 'Tell the story of a big move: why it happened and what you left behind.', 'Racontez un grand déménagement : pourquoi ce départ, et ce que vous avez laissé derrière vous.'],
    ['places-history', 'Which historic event did you live through, and where were you when it happened?', 'Quel événement historique avez-vous vécu, et où étiez-vous à ce moment-là ?'],
    ['places-return', 'Is there a place you would love to see one more time?', 'Y a-t-il un endroit que vous aimeriez revoir une dernière fois ?'],
  ]),
  chapter('lessons', { en: 'Lessons', fr: 'Leçons de vie' }, [
    ['lessons-turning-point', 'What was the biggest turning point in your life?', 'Quel a été le plus grand tournant de votre vie ?'],
    ['lessons-hardest', 'What is the hardest thing you have been through, and how did you get through it?', 'Quelle est l’épreuve la plus difficile que vous ayez traversée, et comment l’avez-vous surmontée ?'],
    ['lessons-changed-mind', 'What have you changed your mind about over the years?', 'Sur quoi avez-vous changé d’avis au fil des années ?'],
    ['lessons-differently', 'Is there something you wish you had done differently?', 'Y a-t-il quelque chose que vous auriez aimé faire autrement ?'],
    ['lessons-pride', 'What are you proudest of in your life?', 'De quoi tirez-vous le plus de fierté dans votre vie ?'],
    ['lessons-values', 'Which values have guided your life, and where did they come from?', 'Quelles valeurs ont guidé votre vie, et d’où viennent-elles ?'],
    ['lessons-remembered', 'What do you hope the people you love will remember about you?', 'Que souhaitez-vous que vos proches retiennent de vous ?'],
  ]),
];

export const MEMOIR_QUESTIONS: readonly MemoirQuestion[] = MEMOIR_CHAPTERS.flatMap((item) => item.questions);

const QUESTIONS_BY_ID = new Map(MEMOIR_QUESTIONS.map((question) => [question.id, question]));
const CHAPTERS_BY_ID = new Map(MEMOIR_CHAPTERS.map((item) => [item.id, item]));

export function findMemoirQuestion(questionId: string): MemoirQuestion | undefined {
  return QUESTIONS_BY_ID.get(questionId);
}

export function findMemoirChapter(chapterId: string): MemoirChapter | undefined {
  return CHAPTERS_BY_ID.get(chapterId);
}

export function resolveMemoirLanguage(language: string | undefined): MemoirLanguage {
  return language === 'fr' ? 'fr' : 'en';
}

/**
 * The next question to offer after `currentId`: the first unanswered one that
 * follows it in life order, wrapping around. The current question is kept when
 * it is the only one left unanswered, and null means every question is answered.
 */
export function nextUnansweredQuestion(
  currentId: string | null,
  answeredIds: ReadonlySet<string>,
): MemoirQuestion | null {
  const currentIndex = currentId ? MEMOIR_QUESTIONS.findIndex((question) => question.id === currentId) : -1;
  // Without a known current question every question is a candidate; otherwise all but the current one.
  const candidates = currentIndex === -1 ? MEMOIR_QUESTIONS.length : MEMOIR_QUESTIONS.length - 1;
  for (let offset = 0; offset < candidates; offset++) {
    const candidate = MEMOIR_QUESTIONS[(currentIndex + 1 + offset) % MEMOIR_QUESTIONS.length];
    if (!answeredIds.has(candidate.id)) {
      return candidate;
    }
  }
  const current = currentId ? findMemoirQuestion(currentId) : undefined;
  return current && !answeredIds.has(current.id) ? current : null;
}
