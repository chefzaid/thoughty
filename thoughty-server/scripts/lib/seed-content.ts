/**
 * Deterministic writing material for the development seed.
 * Everything is driven by a seeded PRNG so every run produces the same journal.
 */

export type Rng = () => number;

export function createRng(seed: number): Rng {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
export const chance = (rng: Rng, probability: number): boolean => rng() < probability;
export const between = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

export function pickSome<T>(rng: Rng, items: readonly T[], count: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    while (pool.length > 0 && result.length < count) {
        result.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return result;
}

const FILLERS: Record<string, readonly string[]> = {
    friend: ['Nadia', 'Tom', 'Ines', 'Karim', 'Julia', 'Omar', 'Chloé', 'Ben'],
    colleague: ['Sophie', 'Marc', 'Priya', 'Lukas', 'Amel', 'David'],
    place: ['the canal', 'the old bookshop', 'the park by the river', 'our favorite café', 'the market', 'the rooftop', 'the library'],
    book: ['Meditations', 'Thinking, Fast and Slow', 'The Remains of the Day', 'Atomic Habits', 'Man\'s Search for Meaning', 'The Overstory', 'Sapiens', 'Stoner', 'The Myth of Sisyphus', 'Four Thousand Weeks'],
    dish: ['lentil soup', 'shakshuka', 'risotto', 'couscous', 'ramen', 'a lemon tart', 'tagine', 'fresh pasta'],
    song: ['an old Fairuz record', 'Nils Frahm', 'a Bach cello suite', 'Radiohead', 'some bossa nova', 'Khruangbin'],
    number: ['three', 'four', 'five', 'six', 'seven', 'ten', 'twelve'],
    distance: ['5', '8', '10', '12', '15', '21'],
    time: ['6am', 'early morning', 'lunch', 'late afternoon', 'dusk', 'late at night'],
};

export function fill(rng: Rng, template: string): string {
    return template.replaceAll(/\{(\w+)\}/g, (match, key: string) => (FILLERS[key] ? pick(rng, FILLERS[key]) : match));
}

export interface Topic {
    tags: readonly string[];
    sentences: readonly string[];
}

export const TOPICS: Record<string, Topic> = {
    work: {
        tags: ['work', 'career', 'meetings', 'projects'],
        sentences: [
            'Long day at work. The {number} meetings back to back left no time for actual thinking.',
            'Shipped the feature I had been dreading. It went better than expected.',
            'Had a hard conversation with {colleague} about priorities. We ended up agreeing more than I thought we would.',
            'I noticed I do my best work before lunch and waste most afternoons on small tasks.',
            'The project deadline moved again. I am learning to stop taking that personally.',
            'Presented the roadmap today. My hands were shaking for the first minute, then it was fine.',
            'Spent the whole morning debugging something that turned out to be a typo.',
            '{colleague} asked for my advice on a career move, which made me realize how far I have come.',
            'I want work to be a part of my life, not the whole of it.',
            'Quiet day at the office. Cleared my inbox and wrote documentation nobody asked for but everyone needs.',
            'Got feedback that I interrupt people in meetings. It stung, but it is fair.',
            'Wrote down what I actually want from my career in five years. The answer surprised me.',
        ],
    },
    health: {
        tags: ['health', 'running', 'sleep', 'fitness'],
        sentences: [
            'Ran {distance}km along {place} at {time}. Legs heavy, head clear.',
            'Slept badly again. Too much screen time before bed, I know it.',
            'Went to the gym for the first time in two weeks. Humbling.',
            'Eight hours of sleep and I feel like a different person.',
            'My knee is complaining after yesterday\'s run, so today was a slow walk instead.',
            'Drank more water, walked 10,000 steps, went to bed at ten. Boring and effective.',
            'Tried a new stretching routine in the morning. My back already thanks me.',
            'I keep saying health comes first and then act like it comes last.',
            'Did the long run of the week: {distance}km. The last kilometer was pure stubbornness.',
            'Skipped training to rest. Learning that rest is part of the plan, not a failure of it.',
        ],
    },
    family: {
        tags: ['family', 'parents'],
        sentences: [
            'Called my parents. Dad told the same story about his first car and I let him tell it all the way through.',
            'Sunday lunch at my parents\' place. Mom made {dish} and insisted I take the leftovers home.',
            'My sister and I finally talked about the argument from last year. We are okay.',
            'Grandma turned ninety today. The whole family in one room, loud and happy.',
            'I realized I am starting to sound like my father, and I don\'t hate it.',
            'Helped Mom set up her new phone. Patience is a muscle.',
            'Family dinner went late. We laughed until our faces hurt.',
            'Missing home today more than usual.',
        ],
    },
    friends: {
        tags: ['friends', 'social'],
        sentences: [
            'Dinner with {friend} at {place}. We talked for three hours and it felt like twenty minutes.',
            '{friend} is going through a rough time. I mostly listened, which is what they needed.',
            'Board game night. I lost every single game and had the best time.',
            'Reconnected with {friend} after almost a year. Some friendships just pick up where they left off.',
            'Too many social plans this week. I need a quiet evening to recharge.',
            'Coffee with {friend}, who always asks the questions I avoid asking myself.',
            'Birthday party for {friend}. Danced badly and happily.',
        ],
    },
    reading: {
        tags: ['books', 'reading', 'learning'],
        sentences: [
            'Finished {book}. I will be thinking about the ending for a while.',
            'Started reading {book} on the train. Underlined half of the first chapter.',
            'Read for an hour instead of scrolling. I should do that every night.',
            'A line from {book} stayed with me all day: the obstacle is part of the path.',
            'Library haul: {number} books I will probably not finish before they are due.',
            'Took notes on {book} and realized I disagree with the author on almost everything. Useful anyway.',
            'Learning something new is uncomfortable in the best way.',
        ],
    },
    philosophy: {
        tags: ['philosophy', 'meaning', 'reflection'],
        sentences: [
            'What would I do differently if I truly accepted that my time is limited?',
            'I keep coming back to the idea that happiness is a byproduct, not a goal.',
            'Is it possible to be ambitious and content at the same time? I think so, but I have not figured out how.',
            'Most of my worries are about things that never happen. Seneca said it better two thousand years ago.',
            'Freedom might just be the ability to choose what I pay attention to.',
            'Thought about what a good life means to me. Right now: people I love, work that matters, time to think.',
            'The older I get, the less certain I am about big questions and the more certain about small ones.',
            'If nobody would ever know, would I still do it? That seems like a good test for most decisions.',
            'I confuse being busy with being meaningful more often than I would like to admit.',
        ],
    },
    creativity: {
        tags: ['writing', 'music', 'photography'],
        sentences: [
            'Wrote 800 words of the short story. Most of them are bad and that is fine.',
            'Played guitar for an hour listening to {song}. My fingers remembered more than I expected.',
            'Took photos around {place} during golden hour. Two of them are actually good.',
            'Creative block all week. Went for a walk and the idea arrived halfway home.',
            'Finished a new song. It is rough, but it is mine.',
            'Rearranged my desk so the guitar is always within reach. Small change, big difference.',
        ],
    },
    food: {
        tags: ['cooking', 'food'],
        sentences: [
            'Cooked {dish} from scratch. Took twice as long as the recipe said and was worth it.',
            'Tried a new restaurant near {place}. Great food, terrible music.',
            'Meal-prepped for the week. Future me will be grateful.',
            'Baked bread for the first time. It is dense, but it is bread.',
            'Invited friends over for {dish}. Nobody left hungry.',
        ],
    },
    money: {
        tags: ['finances', 'budget'],
        sentences: [
            'Went through the monthly budget. Subscriptions are quietly eating my money.',
            'Put a bit more into savings this month. Small, but it adds up.',
            'Impulse-bought headphones I did not need. Noting it here so I remember the feeling.',
            'Finally set up an emergency fund. It feels like a weight off my shoulders.',
            'Money anxiety today. Wrote down the actual numbers and it was less scary on paper.',
        ],
    },
    nature: {
        tags: ['nature', 'hiking', 'weather'],
        sentences: [
            'First snow of the year. The city went quiet.',
            'Hiked the ridge trail. The view at the top made every step worth it.',
            'Rainy day. Stayed in with tea and {song}.',
            'Spring is here. The trees along {place} are suddenly green.',
            'Heatwave. Everything slows down, including me.',
            'Watched the sunset from {place}. Remembered to put my phone away.',
        ],
    },
    mind: {
        tags: ['mood', 'anxiety', 'stress', 'therapy'],
        sentences: [
            'Anxious for no clear reason today. Naming it helped a little.',
            'Therapy session was intense. We talked about why I find it so hard to ask for help.',
            'Feeling light and happy today, and I want to remember it.',
            'Stress is piling up. Made a list, picked the one thing that matters most, did that.',
            'Low mood all afternoon. A walk and a phone call with {friend} turned it around.',
            'I snapped at someone I love because I was tired. Apologized. Need to sleep more.',
            'Noticed my inner critic is loudest when I am hungry or tired. Good to know.',
            'Meditated for ten minutes. My mind wandered every few seconds and that is the practice.',
        ],
    },
    growth: {
        tags: ['goals', 'habits', 'planning', 'growth'],
        sentences: [
            'Reviewed my goals for the quarter. Two on track, one quietly abandoned, and that is okay.',
            'Day {number} of the new morning routine. Still going.',
            'Broke my streak today. Starting again tomorrow without drama.',
            'Planned the week on Sunday evening. Everything feels more manageable.',
            'Small habits compound. I am only now starting to see it.',
            'Wrote down three things I want to learn this year. Spanish is still on the list, as every year.',
        ],
    },
    home: {
        tags: ['home', 'garden'],
        sentences: [
            'Deep-cleaned the apartment. My head feels clearer too.',
            'The tomatoes on the balcony are finally turning red.',
            'Fixed the leaking tap myself. Unreasonably proud.',
            'Rearranged the living room. It feels like a new place.',
            'Lazy Sunday at home. No plans, no guilt.',
        ],
    },
    side: {
        tags: ['coding', 'side-project'],
        sentences: [
            'Worked on the journal app in the evening. Tags are finally working the way I want.',
            'Refactored half the side project. Nothing new works, but the old stuff is cleaner.',
            'Two hours of coding flow. Forgot to eat dinner.',
            'Someone used my side project and sent a thank-you note. Made my week.',
        ],
    },
    gratitude: {
        tags: ['gratitude'],
        sentences: [
            'Grateful for a slow morning and good coffee.',
            'Grateful for {friend}, who always shows up.',
            'Grateful that my body carried me through a long run today.',
            'Grateful for a warm home on a cold night.',
            'Grateful for small kindnesses from strangers.',
        ],
    },
};

/** Life events that give each year its own flavor and its own top tags. */
export const YEAR_THEMES: Record<number, { tag: string; topics: string[]; sentences: string[] }> = {
    2016: { tag: 'university', topics: ['reading', 'friends', 'creativity'], sentences: ['Last year of university. Thesis deadlines everywhere.', 'Library until closing time again, surrounded by people as tired as me.', 'Graduation is close and I have no idea what comes next.'] },
    2017: { tag: 'first-job', topics: ['work', 'money', 'friends'], sentences: ['Still getting used to the first real job and its rhythm.', 'First paycheck. Paid rent, bought a good pair of shoes.', 'Everyone at work seems to know what they are doing except me.'] },
    2018: { tag: 'moving', topics: ['home', 'friends', 'nature'], sentences: ['Boxes everywhere in the new flat.', 'Learning the new neighborhood one bakery at a time.', 'Moving cities is lonelier than I expected, and more exciting.'] },
    2019: { tag: 'marathon', topics: ['health', 'growth', 'mind'], sentences: ['Marathon training plan: week by week, no shortcuts.', 'Longest run ever today. I cried a little at the end.', 'Race day is getting closer and so is the doubt.'] },
    2020: { tag: 'pandemic', topics: ['mind', 'home', 'family', 'side'], sentences: ['Another day inside. The walls are getting closer.', 'Video calls with family every Sunday now.', 'Learning to make the small apartment feel like a whole world.'] },
    2021: { tag: 'wedding', topics: ['family', 'friends', 'money'], sentences: ['Wedding planning spreadsheet has more tabs than my work projects.', 'Tasted cakes for the wedding. Serious research.', 'Counting down the weeks until the wedding.'] },
    2022: { tag: 'parenthood', topics: ['family', 'mind', 'health'], sentences: ['Sleep is a distant memory, but her smile makes up for it.', 'Emma held my finger for an hour today.', 'Parenthood is the hardest and best thing I have done.'] },
    2023: { tag: 'promotion', topics: ['work', 'growth', 'family'], sentences: ['New role, new responsibilities, same imposter syndrome.', 'Leading the team means my calendar is no longer mine.', 'First performance reviews as a manager. I prepared too much, which is better than too little.'] },
    2024: { tag: 'new-house', topics: ['home', 'money', 'family'], sentences: ['Signed the papers for the house. Terrified and thrilled.', 'Painted the kids\' room a soft green.', 'Our first dinner in the new house, sitting on the floor between boxes.'] },
    2025: { tag: 'parenthood', topics: ['family', 'mind', 'growth'], sentences: ['Lucas is here and our house is louder and fuller.', 'Two kids means twice the chaos and twice the love.', 'Emma is so proud to be a big sister.'] },
    2026: { tag: 'sabbatical', topics: ['philosophy', 'creativity', 'reading', 'growth'], sentences: ['Sabbatical week one: no alarm clock.', 'Finally working on the book I always said I would write.', 'Without work structuring my days, I get to decide what matters.'] },
};

export const DREAM_SENTENCES = [
    'I was flying over a city made of glass, and every window showed a different year of my life.',
    'Dreamt I was back at school and had forgotten about an exam I never signed up for.',
    'In the dream, the ocean was in my childhood bedroom and nobody thought it was strange.',
    'I was lost in an airport where every gate led to the same room.',
    'Dreamt of my grandmother\'s kitchen. It smelled exactly right.',
    'A talking fox gave me directions, but only in riddles.',
    'I was running and could not move forward, the classic one.',
    'The house had an extra room I had never noticed, full of light.',
    'Dreamt my teeth were falling out. Woke up and checked, just in case.',
    'I found a door in the forest that opened onto the street where I grew up.',
    'I was performing on stage and suddenly could play the piano perfectly.',
    'Everything was underwater but we could all breathe and nobody mentioned it.',
];

export const WORK_DIARY_SENTENCES = [
    'Standup ran long again. Proposed a strict fifteen-minute limit.',
    'Sprint planning: we committed to less and I think we will deliver more.',
    'One-on-one with {colleague}. They want to grow into a lead role, and I want to help.',
    'Incident in production this morning. Root cause: a config change nobody reviewed.',
    'Wrote the design doc for the migration. Asked for three reviewers.',
    'Retro went well. People were honest, which means they feel safe.',
    'Interviewed a candidate who asked better questions than I did.',
    'Blocked two hours for focused work and actually protected them.',
    'Quarterly planning. Too many priorities means no priorities.',
    'Paired with {colleague} on the hardest bug of the month. Two heads really are better.',
];

export const TRAVEL_PLACES = [
    { name: 'Lisbon', tag: 'portugal' },
    { name: 'Kyoto', tag: 'japan' },
    { name: 'Marrakech', tag: 'morocco' },
    { name: 'the Scottish Highlands', tag: 'scotland' },
    { name: 'Istanbul', tag: 'turkey' },
    { name: 'Rome', tag: 'italy' },
    { name: 'Reykjavik', tag: 'iceland' },
    { name: 'Barcelona', tag: 'spain' },
    { name: 'Berlin', tag: 'germany' },
    { name: 'Chefchaouen', tag: 'morocco' },
    { name: 'Copenhagen', tag: 'denmark' },
    { name: 'the Dolomites', tag: 'italy' },
];

export const TRAVEL_SENTENCES = [
    'Arrived in {city} late at night. The air smells different here.',
    'Walked around {city} for eight hours with no map and no plan.',
    'Best meal of the trip so far in a tiny place in {city} with no menu.',
    'Got completely lost in {city} and found the most beautiful square.',
    'Museum morning, market afternoon, long dinner. {city} is kind to slow travelers.',
    'Last day in {city}. Already planning to come back.',
    'Took the early train out of {city} and watched the landscape wake up.',
    'The locals in {city} laughed at my attempts at the language, kindly.',
];

export const TAG_METADATA: Record<string, { color: string; category: string }> = {
    work: { color: '#2563EB', category: 'Work' },
    career: { color: '#1D4ED8', category: 'Work' },
    meetings: { color: '#3B82F6', category: 'Work' },
    projects: { color: '#60A5FA', category: 'Work' },
    'first-job': { color: '#1E40AF', category: 'Work' },
    promotion: { color: '#2563EB', category: 'Work' },
    health: { color: '#059669', category: 'Health' },
    running: { color: '#10B981', category: 'Health' },
    sleep: { color: '#34D399', category: 'Health' },
    fitness: { color: '#047857', category: 'Health' },
    marathon: { color: '#065F46', category: 'Health' },
    family: { color: '#DC2626', category: 'Life' },
    parents: { color: '#EF4444', category: 'Life' },
    parenthood: { color: '#B91C1C', category: 'Life' },
    wedding: { color: '#F43F5E', category: 'Life' },
    friends: { color: '#EA580C', category: 'Life' },
    social: { color: '#F97316', category: 'Life' },
    home: { color: '#CA8A04', category: 'Life' },
    'new-house': { color: '#A16207', category: 'Life' },
    moving: { color: '#EAB308', category: 'Life' },
    mood: { color: '#7C3AED', category: 'Mind' },
    anxiety: { color: '#6D28D9', category: 'Mind' },
    stress: { color: '#8B5CF6', category: 'Mind' },
    therapy: { color: '#A78BFA', category: 'Mind' },
    philosophy: { color: '#0891B2', category: 'Mind' },
    meaning: { color: '#06B6D4', category: 'Mind' },
    reflection: { color: '#0E7490', category: 'Mind' },
    gratitude: { color: '#DB2777', category: 'Mind' },
    books: { color: '#4F46E5', category: 'Growth' },
    reading: { color: '#6366F1', category: 'Growth' },
    learning: { color: '#818CF8', category: 'Growth' },
    goals: { color: '#0F766E', category: 'Growth' },
    habits: { color: '#14B8A6', category: 'Growth' },
    growth: { color: '#115E59', category: 'Growth' },
    planning: { color: '#2DD4BF', category: 'Growth' },
    writing: { color: '#C026D3', category: 'Leisure' },
    music: { color: '#D946EF', category: 'Leisure' },
    photography: { color: '#A21CAF', category: 'Leisure' },
    cooking: { color: '#B45309', category: 'Leisure' },
    food: { color: '#D97706', category: 'Leisure' },
    travel: { color: '#0284C7', category: 'Places' },
    nature: { color: '#16A34A', category: 'Places' },
    hiking: { color: '#15803D', category: 'Places' },
    // Created in the Tags view but not used by any entry yet.
    'bucket-list': { color: '#F59E0B', category: 'Growth' },
    stoicism: { color: '#155E75', category: 'Mind' },
    'someday-maybe': { color: '#9CA3AF', category: '' },
};
