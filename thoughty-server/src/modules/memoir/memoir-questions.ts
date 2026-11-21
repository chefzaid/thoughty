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
  /** A theme the writer adds to their memoir by choice; the other chapters are every writer's year. */
  readonly theme: boolean;
  readonly questions: readonly MemoirQuestion[];
}

type QuestionSeed = readonly [id: string, en: string, fr: string];

function chapter(id: string, title: LocalizedText, seeds: readonly QuestionSeed[], theme = false): MemoirChapter {
  return {
    id,
    title,
    theme,
    questions: seeds.map(([questionId, en, fr]) => ({ id: questionId, chapterId: id, text: { en, fr } })),
  };
}

/**
 * The guided memoir: a year of weekly questions, ordered as a life story so that
 * chapters (one tag each) read in order when the memoir diary becomes a book.
 * Themed chapters sit at their place in that story and join the weekly questions
 * only for writers who choose them.
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
  chapter('parenthood', { en: 'Parenthood', fr: 'Être parent' }, [
    ['parenthood-news', 'How did you learn you were going to be a parent, and how did you feel?', 'Comment avez-vous appris que vous alliez devenir parent, et qu’avez-vous ressenti ?'],
    ['parenthood-first-days', 'What do you remember of the first days with your first child?', 'Que vous rappelez-vous des premiers jours avec votre premier enfant ?'],
    ['parenthood-names', 'How did you choose your children’s names?', 'Comment avez-vous choisi les prénoms de vos enfants ?'],
    ['parenthood-ordinary-day', 'Describe an ordinary day when your children were small.', 'Décrivez une journée ordinaire quand vos enfants étaient petits.'],
    ['parenthood-hardest', 'What was the hardest part of being a parent, and what helped?', 'Qu’est-ce qui a été le plus difficile dans votre vie de parent, et qu’est-ce qui a aidé ?'],
    ['parenthood-own-parents', 'What did you do the same as your own parents, and what did you do differently?', 'Qu’avez-vous fait comme vos propres parents, et qu’avez-vous fait autrement ?'],
    ['parenthood-relive', 'Which moment with your children would you love to live again?', 'Quel moment avec vos enfants aimeriez-vous revivre ?'],
  ], true),
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
  chapter('careers', { en: 'Careers', fr: 'Parcours professionnel' }, [
    ['careers-first-job', 'What was your very first job, and what did it teach you?', 'Quel a été votre tout premier emploi, et que vous a-t-il appris ?'],
    ['careers-change', 'Did you ever change direction in your working life? What made you do it?', 'Avez-vous changé de voie au cours de votre vie professionnelle ? Qu’est-ce qui vous y a poussé ?'],
    ['careers-hardest-decision', 'What was the hardest decision you made at work?', 'Quelle a été la décision la plus difficile que vous ayez prise au travail ?'],
    ['careers-balance', 'How did you balance work with family and the rest of your life?', 'Comment avez-vous concilié le travail avec la famille et le reste de votre vie ?'],
    ['careers-valued', 'When did you feel your work mattered most?', 'À quel moment avez-vous eu le sentiment que votre travail comptait le plus ?'],
    ['careers-retirement', 'If you have retired, how did your last working day feel, and what filled the time after?', 'Si vous êtes à la retraite, comment avez-vous vécu votre dernier jour de travail, et qu’est-ce qui a rempli le temps ensuite ?'],
    ['careers-other-path', 'Which other career might you have had, and do you ever wonder about it?', 'Quel autre métier auriez-vous pu exercer, et vous arrive-t-il d’y penser ?'],
  ], true),
  chapter('places', { en: 'Places', fr: 'Lieux' }, [
    ['places-hometown', 'What was your town or neighborhood like back then, and how has it changed?', 'Comment était votre ville ou votre quartier à l’époque, et comment a-t-il changé ?'],
    ['places-homes', 'List the places you have lived. Which one felt most like home?', 'Énumérez les endroits où vous avez vécu. Lequel vous a le plus donné le sentiment d’être chez vous ?'],
    ['places-journey', 'Which journey changed the way you saw the world?', 'Quel voyage a changé votre regard sur le monde ?'],
    ['places-peace', 'Where do you go, or wish you could go, to feel at peace?', 'Où allez-vous, ou aimeriez-vous aller, pour trouver la paix ?'],
    ['places-move', 'Tell the story of a big move: why it happened and what you left behind.', 'Racontez un grand déménagement : pourquoi ce départ, et ce que vous avez laissé derrière vous.'],
    ['places-history', 'Which historic event did you live through, and where were you when it happened?', 'Quel événement historique avez-vous vécu, et où étiez-vous à ce moment-là ?'],
    ['places-return', 'Is there a place you would love to see one more time?', 'Y a-t-il un endroit que vous aimeriez revoir une dernière fois ?'],
  ]),
  chapter('migration', { en: 'Migration', fr: 'Migration' }, [
    ['migration-decision', 'If you or your family left one country for another, what led to that decision?', 'Si vous ou votre famille avez quitté un pays pour un autre, qu’est-ce qui a mené à cette décision ?'],
    ['migration-journey', 'Tell the story of the journey itself: how you travelled and what you carried with you.', 'Racontez le voyage lui-même : comment vous êtes partis et ce que vous avez emporté.'],
    ['migration-first-days', 'What do you remember of your first days in the new country?', 'Que vous rappelez-vous de vos premiers jours dans le nouveau pays ?'],
    ['migration-language', 'How did you learn the language and the customs of your new home?', 'Comment avez-vous appris la langue et les usages de votre nouveau pays ?'],
    ['migration-kept', 'Which habits, dishes, or words from where you came from have you kept?', 'Quelles habitudes, quels plats ou quels mots de votre pays d’origine avez-vous gardés ?'],
    ['migration-left-behind', 'Who and what did you leave behind, and how did you stay in touch?', 'Qui et quoi avez-vous laissé derrière vous, et comment êtes-vous restés en contact ?'],
    ['migration-roots', 'What would you want your grandchildren to know about where your family comes from?', 'Que voudriez-vous que vos petits-enfants sachent de l’endroit d’où vient votre famille ?'],
  ], true),
  chapter('history', { en: 'War and history', fr: 'Guerre et histoire' }, [
    ['history-news', 'Which news do you remember hearing as a child, and how did the adults around you react?', 'De quelle nouvelle vous souvenez-vous avoir entendu parler enfant, et comment les adultes autour de vous ont-ils réagi ?'],
    ['history-war-family', 'How did a war or conflict touch your family, whether you lived it or heard about it?', 'Comment une guerre ou un conflit a-t-il touché votre famille, que vous l’ayez vécu ou que l’on vous l’ait raconté ?'],
    ['history-daily-life', 'How did everyday life change during a time of war, unrest, or hardship you lived through?', 'Comment la vie quotidienne a-t-elle changé pendant une période de guerre, de troubles ou de privations que vous avez traversée ?'],
    ['history-service', 'If you or someone close to you served in the armed forces, what do you want remembered about it?', 'Si vous ou un proche avez servi dans l’armée, que souhaitez-vous que l’on en retienne ?'],
    ['history-change', 'Which change in society did you witness that people today might find hard to believe?', 'De quel changement de société avez-vous été témoin que l’on aurait du mal à croire aujourd’hui ?'],
    ['history-courage', 'Who showed courage in a difficult time you lived through?', 'Qui a fait preuve de courage pendant une période difficile que vous avez vécue ?'],
    ['history-understand', 'What should younger generations understand about the times you lived through?', 'Que devraient comprendre les plus jeunes de l’époque que vous avez traversée ?'],
  ], true),
  chapter('faith', { en: 'Faith and beliefs', fr: 'Foi et convictions' }, [
    ['faith-upbringing', 'What part did faith or spiritual practice play in the home you grew up in?', 'Quelle place la foi ou la pratique spirituelle avait-elle dans la maison de votre enfance ?'],
    ['faith-own', 'How have your own beliefs about life and its meaning changed over the years?', 'Comment vos convictions sur la vie et son sens ont-elles évolué au fil des années ?'],
    ['faith-ritual', 'Which ritual, prayer, or tradition has meant the most to you?', 'Quel rite, quelle prière ou quelle tradition a le plus compté pour vous ?'],
    ['faith-doubt', 'Tell about a time of doubt or questioning, and what came of it.', 'Racontez une période de doute ou de questionnement, et ce qu’elle vous a apporté.'],
    ['faith-community', 'Which community, of faith or otherwise, was there for you in hard times?', 'Quelle communauté, religieuse ou non, a été là pour vous dans les moments difficiles ?'],
    ['faith-wonder', 'What fills you with wonder, or a sense of something larger than yourself?', 'Qu’est-ce qui vous émerveille, ou vous donne le sentiment de quelque chose de plus grand que vous ?'],
    ['faith-pass-on', 'Which beliefs or questions would you like to pass on to the next generation?', 'Quelles convictions ou quelles questions aimeriez-vous transmettre à la génération suivante ?'],
  ], true),
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

/** The themed chapters a writer can add to their memoir, in life order. */
export const MEMOIR_THEME_IDS: readonly string[] = MEMOIR_CHAPTERS.filter((item) => item.theme).map((item) => item.id);

const QUESTIONS_BY_ID = new Map(MEMOIR_QUESTIONS.map((question) => [question.id, question]));
const CHAPTERS_BY_ID = new Map(MEMOIR_CHAPTERS.map((item) => [item.id, item]));
const LIFE_ORDER = new Map(MEMOIR_QUESTIONS.map((question, index) => [question.id, index]));

export function findMemoirQuestion(questionId: string): MemoirQuestion | undefined {
  return QUESTIONS_BY_ID.get(questionId);
}

export function findMemoirChapter(chapterId: string): MemoirChapter | undefined {
  return CHAPTERS_BY_ID.get(chapterId);
}

export function resolveMemoirLanguage(language: string | undefined): MemoirLanguage {
  return language === 'fr' ? 'fr' : 'en';
}

/** The chosen themes that exist, each once, in life order (an unknown or retired theme is dropped). */
export function normalizeMemoirThemes(themes: readonly string[]): string[] {
  const chosen = new Set(themes);
  return MEMOIR_THEME_IDS.filter((id) => chosen.has(id));
}

/** The chapters of a writer's memoir: every writer's year plus the themes they chose, in life order. */
export function memoirChaptersFor(themes: readonly string[]): MemoirChapter[] {
  const chosen = new Set(themes);
  return MEMOIR_CHAPTERS.filter((item) => !item.theme || chosen.has(item.id));
}

/** The questions of a writer's memoir, in life order. */
export function memoirQuestionsFor(themes: readonly string[]): MemoirQuestion[] {
  return memoirChaptersFor(themes).flatMap((item) => item.questions);
}

/**
 * The next question to offer after `currentId`: the first unanswered one of the writer's
 * memoir (its year and chosen `themes`) that follows it in life order, wrapping around. A
 * current question from a theme the writer has since left still marks the place. The current
 * question is kept when it is the only one left unanswered, and null means every question is answered.
 */
export function nextUnansweredQuestion(
  currentId: string | null,
  answeredIds: ReadonlySet<string>,
  themes: readonly string[] = [],
): MemoirQuestion | null {
  const schedule = memoirQuestionsFor(themes);
  const place = currentId ? (LIFE_ORDER.get(currentId) ?? -1) : -1;
  const order = (question: MemoirQuestion) => LIFE_ORDER.get(question.id) ?? -1;
  // Without a known current question every question is a candidate; otherwise all but the current one.
  const candidates = [
    ...schedule.filter((question) => order(question) > place),
    ...schedule.filter((question) => order(question) < place),
  ];
  const next = candidates.find((question) => !answeredIds.has(question.id));
  if (next) {
    return next;
  }
  const current = schedule.find((question) => question.id === currentId);
  return current && !answeredIds.has(current.id) ? current : null;
}

/** Questions set aside with "Not this week": question ID → the writer's day (`YYYY-MM-DD`) it comes back. */
export type MemoirSnoozes = ReadonlyMap<string, string>;

/** Whether a set-aside question is still away on the writer's day `today` (it is back from its day on). */
export function isSnoozed(questionId: string, snoozes: MemoirSnoozes, today: string): boolean {
  const until = snoozes.get(questionId);
  return until !== undefined && until > today;
}

/**
 * The question to offer after `currentId`. A set-aside question whose day has come goes first (the
 * earliest day first, then in life order), so "Not this week" brings it back a few weeks later rather
 * than after a whole round of the queue; otherwise the next unanswered one in life order, leaving out
 * every set-aside question. Only questions of the writer's memoir (its year and chosen `themes`) are
 * offered. Null when every question is answered or set aside.
 */
export function nextQueuedQuestion(
  currentId: string | null,
  answeredIds: ReadonlySet<string>,
  snoozes: MemoirSnoozes,
  today: string,
  themes: readonly string[] = [],
): MemoirQuestion | null {
  const returned = memoirQuestionsFor(themes).filter(
    (question) =>
      question.id !== currentId &&
      !answeredIds.has(question.id) &&
      snoozes.has(question.id) &&
      !isSnoozed(question.id, snoozes, today),
  ).sort((a, b) => (snoozes.get(a.id) ?? '').localeCompare(snoozes.get(b.id) ?? ''));
  if (returned.length > 0) {
    return returned[0];
  }
  return nextUnansweredQuestion(currentId, new Set([...answeredIds, ...snoozes.keys()]), themes);
}
