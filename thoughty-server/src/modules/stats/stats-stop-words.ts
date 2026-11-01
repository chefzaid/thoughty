/*
 * Common English and French words, left out of **Words you use most**. They are written the way the
 * tokenizer leaves a word (`stats-words.ts`): in lower case, with accents, a straight apostrophe and
 * without French elisions, so `l’été` is checked as `été` and `don’t` as `don't`.
 *
 * PostgreSQL ships stop words for both languages (`english.stop` and `french.stop`, used by the
 * `thoughty_en` and `thoughty_fr` search configurations), but they are not reused here:
 * - they are read only through the Snowball dictionaries, which return stems (`jardin` for
 *   `jardins`), while the list shows each word as written;
 * - its parser splits on apostrophes, so the lists hold fragments (`don`, `t`, `qu`) rather than
 *   `don't` or `aujourd'hui`, and they miss many words a diary is full of (`really`, `today`,
 *   `aussi`, `comme`, `tout`);
 * - they live on the database server, so the tokenizer could not be tested without it.
 * This list starts from those two lists and adds the contractions and everyday words they miss.
 */

const ENGLISH = `
a about above after again against all almost along already also although always am among an and
another any anyone anything are aren't around as at away back be because been before being below
between both but by can can't cannot could couldn't did didn't do does doesn't doing don't done down
during each either else enough even ever every everything few for from further get gets getting go
goes going gone got gotten had hadn't has hasn't have haven't having he he'd he'll he's her here
here's hers herself him himself his how how's however i i'd i'll i'm i've if in into is isn't it it'd
it'll it's its itself just least less let let's like lot lots made make makes many may maybe me might
more most much must mustn't my myself neither never no none nor not nothing now o'clock of off often
oh ok okay on once one only onto or other others otherwise our ours ourselves out over own per quite
rather really same shall shan't she she'd she'll she's should shouldn't since so some someone
something sometimes soon still such than that that's the their theirs them themselves then there
there's these they they'd they'll they're they've thing things this those though through thus till to
today together too toward towards under until up upon us very via want wanted was wasn't way we we'd
we'll we're we've well went were weren't what what's whatever when when's where where's whether which
while who who's whoever whole whom whose why why's will with within without won't would wouldn't yeah
yes yet you you'd you'll you're you've your yours yourself yourselves
`;

const FRENCH = `
à afin ai aie aient aies ailleurs ainsi ait alors as assez au aucun aucune aujourd'hui auquel aura
aurai auraient aurais aurait auras aurez auriez aurions aurons auront aussi autant autre autres aux
avaient avais avait avant avec avez aviez avions avoir avons ayant beaucoup bien ça car ce ceci cela
celle celles celui cependant certes ces cet cette ceux chaque chez ci comme comment contre d'abord
dans de dedans dehors déjà depuis des desquels dessous dessus doit doivent donc dont du duquel durant
elle elles en encore entre es est et étaient étais était étant été êtes étiez étions être eu eue eues
eurent eus eut eux fais fait faire faisait faut fois font fûmes furent fus fut ici il ils jamais je
jusque la là laquelle le lequel les lesquelles lesquels leur leurs lors lorsque lui ma mais me même
mêmes mes moi moins mon ne ni non nos notre nous ou où oui par parce parfois pas pendant peu peut
peuvent peux plus plupart plusieurs plutôt pour pourquoi pourtant pu puis puisque quand quant que
quel quelle quelles quelque quelques quelqu'un quels qui quoi sa sans se selon sera serai seraient serais serait
seras serez seriez serions serons seront ses si sinon soi soient sois soit sommes son sont sous
souvent soyez soyons suis sur ta tant te tellement tes toi ton toujours tous tout toute toutes très
trop tu un une va vais vers via voici voilà vont vos votre vous vraiment y
`;

const words = (list: string): string[] => list.trim().split(/\s+/);

/** The common words left out of the ranking, in both languages. */
export const STOP_WORDS: ReadonlySet<string> = new Set([...words(ENGLISH), ...words(FRENCH)]);
