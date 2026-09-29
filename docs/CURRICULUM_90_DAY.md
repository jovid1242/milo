# Milo — 90-Day English Curriculum

The learning design of the 90-day course: what every day teaches, in what order and why. This is
the blueprint production content is written against. It is not the content itself: no word lists,
no full grammar explanations, no texts, no exam questions.

- **Source of truth** is data, not this page: `src/content/course/curriculum/` (syllabus, bands,
  theme families, outcomes and one draft per day). The course build attaches each day's plan to its
  `CourseDay.curriculum`; the syllabus is `Course.curriculum`.
- **Generated sections** of this page (bands, grammar syllabus, day map, checkpoints, Final Battle,
  outcomes, stats) are rendered from that data by `npm run curriculum:doc`. A test fails when they
  are out of date. Everything else here is written by hand.
- **Checks**: `npm run content:validate` validates the course and the curriculum together and
  fails on any error.

## 1. Strategy

**Target learner.** An adult Russian speaker at about A2: knows the basics, understands simple
everyday English, has gaps and little confidence speaking. Studies about 20 minutes a day: four
short quests (vocabulary, grammar, reading, review), a weekly exam every seventh day, the Final
Battle on Day 90.

**What 90 days can do.** About 30 hours of focused study. That is not enough to make anyone fluent,
and the course never promises it. The realistic goal is to:

- grow the active vocabulary by the course's core (534 words met, most of them reviewed four or
  more times);
- make the A2 grammar solid and bring in the core B1 structures;
- understand short everyday texts better, including what is implied;
- build connected sentences about everyday life, past, plans and opinions;
- make English a daily habit;
- move the learner towards a stable B1.

**Expected level on Day 90:** a solid A2+ moving into B1 — B1 in understanding everyday texts and
core B1 grammar, not yet consistent B1 in free speaking or writing.

**Principles.**

- **Spiral, not a list.** Themes come back in harder contexts (work: a day at work → rules →
  teamwork → a job interview). Grammar topics are introduced once and then practised, contrasted
  and consolidated on later days.
- **One step at a time.** Each band moves one or two things (text length, inference, grammar,
  Russian support) — never all of them at once.
- **Nothing disappears.** Every day's material is planned to come back: in reviews two days, a week
  and three weeks later, in the weekly exam, in later texts, in the Final Battle.
- **The day is one lesson.** Vocabulary, grammar and reading share the day's theme: the grammar
  examples use the day's words, the text uses the day's grammar.
- **Mobile microlearning.** Every text is readable on a phone in a few minutes; no quest needs
  more than five or six minutes.
- **The plan decides, not the day number.** Checkpoints and the summit come from the course plan
  (`CourseDay.kind`); the curriculum never works them out from `day % 7`.

## 2. Difficulty curve

Four bands, finer than CEFR. Each sits inside one CEFR level, so the course's existing `level`
fields do not change: Chapters 1–2 are `A2`, Chapters 3–5 are `B1`. A chapter declares its band;
its days' `level` follows from it, and the validator checks that it never goes down. Material may
be one CEFR step below its day (an A1 grammar refresher on an A2 day), never above.

<!-- curriculum:bands -->

| Band | CEFR | Chapters       | Reading                                              | Questions | Review      | Russian                                                                                                                                       |
| ---- | ---- | -------------- | ---------------------------------------------------- | --------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A2   | A2   | Beginning      | 50–110 words; main idea, detail, inference           | 3         | 6 (4 today) | Every new word has a Russian translation; grammar is explained in simple English with Russian where it helps; texts are short and glossed.    |
| A2+  | A2   | Momentum       | 90–170 words; main idea, detail, inference           | 3–4       | 8 (4 today) | Russian translations for new words; English examples come first; Russian only for tricky grammar points.                                      |
| B1-  | B1   | Habit          | 150–260 words; main idea, detail, inference, context | 4         | 8 (4 today) | English definitions first, the Russian translation as a second hint; grammar explained in English; one word per text worked out from context. |
| B1   | B1   | Growth, Summit | 220–400 words; main idea, detail, inference, context | 4–5       | 8 (4 today) | English first: meaning from context and English definitions; Russian is kept for the translation of new words.                                |

<!-- /curriculum:bands -->

- **Days 1–10 · A2:** A2 refresh. Present tenses and everyday questions about the learner's own
  life.
- **Days 11–30 · A2+:** from single sentences to events and plans.
- **Days 31–60 · B1-:** early B1 structures; longer texts; meaning from context.
- **Days 61–89 · B1:** consolidation of B1; connected ideas; inference.
- **Day 90:** a representative A2 → B1 final assessment.

**Russian support steps back gradually:** Chapter 1 translates every new word and uses Russian
freely in grammar notes where it helps. By Chapter 4 explanations are English-first: meaning comes
from context and English definitions, and Russian is kept for new words' translations. Texts are
English throughout.

## 3. Vocabulary

**How many new words a day.** The existing mechanic teaches 6 new words on every lesson day and
checkpoint day. That sits in the middle of the 5–7 range that suits 5-minute sessions. Fewer would
leave the course too thin to reach B1; more would outrun the review capacity (each review has 6–8
exercises). So the mechanic stays as it is.

**Planned total: 534 new words:** 77 lesson days × 6 plus 12 checkpoint days × 6. Day 90 teaches
none. By chapter: 60 · 120 · 180 · 174. These are words the learner meets and practises; a
realistic retention target is that most of them are recognised in context and the most frequent
are used actively.

**Word selection.**

- High-frequency, general, conversational English at A2–B1: words for real life, not for
  literature.
- No rare words, no synonyms added for the count, no British/American slang.
- Multi-word items count as words when they work as one: _keep in touch_, _give up_, _on time_.
- Every word is taught once. The validator rejects a word taught on two days, and a planned anchor
  word that another day already teaches.
- Checkpoint days teach six "wrap-up" words that help to talk about the week's themes (progress,
  memories, options, planning…). They are reviewed the following week.

**Themes.** Every day has a theme in one of 26 theme families. Families come back in harder
contexts; no two lesson days in a row share a family (validated). The day map gives each day's
vocabulary focus and three anchor words. The anchors are not the list: the content picks six new
words in the focus, including them.

## 4. Repetition

A course-level plan, not an adaptive engine. Material introduced on Day N comes back:

1. **Day N:** in its own quest and in that day's review.
2. **About N+2:** in the review two days later (the "recent" share).
3. **About N+7:** in the review a week later, and in that week's exam.
4. **About N+21 (N+14 early on):** in a review three weeks later (the "older" share).
5. **Later chapters:** in texts (glossed words point at the vocabulary bank), in exercise options,
   and in the Final Battle's sample.

That is at least four planned encounters per item, plus the reuse in texts. The builder works out
each day's review days from this rule. The day map lists them ("4 today · 2 from d013, d008 · 2
from d001").

## 5. Grammar

32 topics over 77 grammar quests. Each topic is **introduced** once, then **practised**,
**contrasted** with a neighbour and **consolidated** on later days. A day can also recycle earlier
topics alongside its own (the "recycled" entries below). The validator checks the objective part:

- a topic's prerequisites are introduced before it;
- nothing is practised, contrasted or consolidated before it is introduced;
- a contrast names what it contrasts with;
- a topic is never above its day's level;
- every topic is revisited at least once (a warning otherwise).

Order, A2 → B1:

- **Chapter 1:** present tenses and questions.
- **Chapter 2:** the past, quantities, comparing, the future, advice and rules; ends with the two
  past tenses together.
- **Chapter 3:** early B1, at most three new topics a week — the Present Perfect (and only then its
  contrast with the Past Simple), used to, verb patterns, possibility, zero and first conditionals,
  relative clauses, the passive, linkers, indirect questions, the Present Perfect Continuous.
- **Chapter 4:** six last new topics (second conditional, deduction, Past Perfect, reported speech,
  too/enough/so/such, phrasal verbs); the last five lesson days only consolidate.

Out of scope on purpose (B2): the third conditional, past modals (_should have_, _must have_),
passives beyond simple tenses and modals.

<!-- curriculum:grammar -->

| Topic                                                  | Level | Needs                                                  | Introduced | Later                                                                                                                                                                                                                                                            |
| ------------------------------------------------------ | ----- | ------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Present Simple                                         | A1    | —                                                      | d001       | d002 practice, d003 practice, d004 recycled, d006 recycled, d010 recycled, d043 recycled, d088 recycled                                                                                                                                                          |
| Adverbs of frequency                                   | A2    | Present Simple                                         | d004       | d006 recycled                                                                                                                                                                                                                                                    |
| Present Continuous                                     | A1    | Present Simple                                         | d005       | d006 contrast, d010 recycled, d023 practice, d025 recycled, d057 recycled, d071 recycled, d088 recycled                                                                                                                                                          |
| There is / there are                                   | A1    | —                                                      | d008       | d017 recycled                                                                                                                                                                                                                                                    |
| can / could: ability, permission, requests             | A2    | —                                                      | d009       | d038 recycled, d072 recycled, d087 recycled                                                                                                                                                                                                                      |
| Questions: question words and word order               | A2    | Present Simple                                         | d010       | d015 recycled, d053 recycled, d078 recycled                                                                                                                                                                                                                      |
| Past Simple                                            | A2    | Present Simple                                         | d011       | d012 practice, d013 practice, d015 practice, d016 consolidate, d029 recycled, d030 recycled, d031 recycled, d034 recycled, d036 recycled, d039 recycled, d051 recycled, d054 recycled, d061 recycled, d065 recycled, d066 recycled, d067 recycled, d089 recycled |
| Countable and uncountable nouns; some, any, much, many | A2    | —                                                      | d017       | d018 practice, d075 recycled                                                                                                                                                                                                                                     |
| Comparatives                                           | A2    | —                                                      | d019       | d020 recycled, d048 practice, d082 consolidate                                                                                                                                                                                                                   |
| Superlatives                                           | A2    | Comparatives                                           | d020       | d048 recycled, d082 recycled                                                                                                                                                                                                                                     |
| be going to                                            | A2    | —                                                      | d022       | d023 recycled, d025 recycled, d071 recycled, d089 recycled                                                                                                                                                                                                       |
| will                                                   | A2    | —                                                      | d024       | d025 contrast, d041 recycled, d044 recycled, d067 recycled, d069 recycled, d071 consolidate, d072 recycled, d089 recycled                                                                                                                                        |
| should: advice                                         | A2    | —                                                      | d026       | d055 practice, d079 recycled, d080 recycled, d087 recycled                                                                                                                                                                                                       |
| have to / must: obligation and rules                   | A2    | —                                                      | d027       | d079 consolidate, d087 recycled                                                                                                                                                                                                                                  |
| Past Continuous                                        | A2    | Past Simple, Present Continuous                        | d029       | d030 contrast, d066 recycled                                                                                                                                                                                                                                     |
| Present Perfect                                        | A2    | Past Simple                                            | d031       | d032 practice, d033 practice, d034 contrast, d050 recycled, d054 consolidate, d057 recycled, d060 recycled, d065 recycled, d074 recycled, d088 recycled, d089 consolidate                                                                                        |
| used to                                                | B1    | Past Simple                                            | d036       | d039 practice, d089 recycled                                                                                                                                                                                                                                     |
| Verb + -ing / verb + to-infinitive                     | B1    | —                                                      | d037       | d040 practice, d055 recycled, d076 practice                                                                                                                                                                                                                      |
| may / might / could: possibility                       | B1    | can / could: ability, permission, requests             | d038       | d041 practice, d055 recycled, d064 recycled, d069 practice, d071 recycled, d087 recycled                                                                                                                                                                         |
| Zero conditional                                       | B1    | Present Simple                                         | d043       | d044 recycled, d059 recycled                                                                                                                                                                                                                                     |
| First conditional                                      | B1    | Zero conditional, will                                 | d044       | d045 practice, d059 consolidate, d061 recycled, d062 recycled                                                                                                                                                                                                    |
| Relative clauses                                       | B1    | —                                                      | d046       | d047 practice, d073 practice                                                                                                                                                                                                                                     |
| The passive                                            | B1    | Present Perfect                                        | d050       | d051 practice, d072 practice                                                                                                                                                                                                                                     |
| Linking ideas                                          | B1    | —                                                      | d052       | d060 consolidate, d085 consolidate                                                                                                                                                                                                                               |
| Indirect questions                                     | B1    | Questions: question words and word order               | d053       | d058 practice, d068 recycled, d078 practice                                                                                                                                                                                                                      |
| Present Perfect Continuous                             | B1    | Present Perfect, Present Continuous                    | d057       | d060 recycled, d074 contrast, d088 consolidate                                                                                                                                                                                                                   |
| Second conditional                                     | B1    | First conditional, Past Simple                         | d061       | d062 contrast, d080 practice                                                                                                                                                                                                                                     |
| must / might / can't: deduction                        | B1    | may / might / could: possibility                       | d064       | d087 consolidate                                                                                                                                                                                                                                                 |
| Past Perfect                                           | B1    | Past Simple, Present Perfect                           | d065       | d066 consolidate                                                                                                                                                                                                                                                 |
| Reported speech                                        | B1    | Past Simple, will                                      | d067       | d068 practice, d081 consolidate                                                                                                                                                                                                                                  |
| too / enough / so / such                               | B1    | Countable and uncountable nouns; some, any, much, many | d075       | d082 recycled                                                                                                                                                                                                                                                    |
| Phrasal verbs                                          | B1    | —                                                      | d083       | d086 practice                                                                                                                                                                                                                                                    |

<!-- /curriculum:grammar -->

## 6. Reading

**Length and difficulty grow one step per chapter:** 50–110 → 90–170 → 150–260 → 220–400 words.
Sentences get longer and join with linkers once linkers are taught. Questions move from main idea,
detail and a simple inference to all four skills: main idea, detail, inference and a word from
context. Early texts use the day's grammar and recent words; later texts deliberately recycle
words from earlier weeks.

**Genres vary:** 12 genres over 77 texts, 3–9 of each — stories, dialogues, messages, emails, blog
posts, travel notes, work situations, personal experiences, short informational texts, notices,
problem/solution texts and opinion texts. Genres are spread so the same one never runs for long.

## 7. Review

A lesson day's review mixes about **50% today · 30% recent · 20% older** (measured over the course:
52 / 26 / 22):

- **Chapter 1:** 6 exercises, 4 on today and 2 on the recent days. Day 1 is today only.
- **From Chapter 2:** 8 exercises — 4 today, 2–4 from about two days and a week ago, 2 from three
  weeks (early on, two weeks) ago.
- **Checkpoint days:** 2 exercises on today's words and the rest on the week the exam covers — a
  warm-up for the exam.

## 8. Day-by-day map

Status: **written** (the day's content exists and fits), **planned** (no content yet), or
**NEEDS_CONTENT_REVISION** (the written content does not fit; see §12).

<!-- curriculum:day-map -->

### Chapter 1 · Beginning — Days 1–10 · A2

Wake up the English you already have and build confidence: talk about yourself, your day and the people and places around you, in the present.

| Day  | Theme                                     | Vocabulary                                                                                  | Grammar                                                                                                                               | Reading                                                                          | Review                      | Status                 |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------- | ---------------------- |
| d001 | Starting the journey (learning)           | Starting to learn: goals, habits and practice — e.g. journey, habit, goal                   | Present Simple · introduce: Present Simple for habits and facts; he / she / it takes -s                                               | story: Milo packs his backpack for the journey (50–110 words)                    | 6 today                     | written                |
| d002 | Morning routine (routine)                 | A morning routine: getting ready and doing things together — e.g. routine, prepare, usually | Present Simple · practice: He, she, it: -s, -es or -ies (works, watches, studies)                                                     | story: Milo’s morning at the camp (50–110 words)                                 | 4 today · 2 from d001       | written                |
| d003 | About me (self)                           | Personal information and simple personality words — e.g. hometown, friendly, shy            | Present Simple · practice: Questions and negatives with do / does: Do you…? She doesn’t…                                              | blog: A new member’s “About me” post (50–110 words)                              | 4 today · 2 from d001       | planned                |
| d004 | My week (routine)                         | Days, times and how often things happen — e.g. weekday, weekend, early                      | Adverbs of frequency · introduce: always … never and time expressions (every day, on Mondays, at 7)                                   | informational: Sleep habits: what most people usually do (50–110 words)          | 4 today · 2 from d002       | planned                |
| d005 | What’s happening now? (home)              | Everyday actions at home — e.g. cook, tidy, relax                                           | Present Continuous · introduce: Present Continuous for actions happening now: I’m cooking, she isn’t working                          | message: A family group chat on Saturday morning (50–110 words)                  | 4 today · 2 from d003       | planned                |
| d006 | Family and friends (relationships)        | Family members, friends and neighbours — e.g. parents, cousin, neighbour                    | Present Continuous · contrast: Present Simple vs Present Continuous: usually vs now, this week                                        | email: An email to a friend: “My sister usually…, but this week…” (50–110 words) | 4 today · 2 from d004       | planned                |
| d007 | CHECKPOINT · Checking progress (learning) | Talking about your own progress — e.g. challenge, mistake, proud                            | Week 1 exam: 9 questions over d001–d006                                                                                               | —                                                                                | 2 today · 4 from the week   | NEEDS_CONTENT_REVISION |
| d008 | Around town (city)                        | Places in town and where they are — e.g. library, pharmacy, opposite                        | There is / there are · introduce: There is / there are with prepositions of place (next to, opposite, between)                        | travelNote: Notes on my new neighbourhood (50–110 words)                         | 4 today · 2 from d006, d001 | planned                |
| d009 | Asking for help (communication)           | Asking for help and understanding each other — e.g. repeat, spell, directions               | can / could: ability, permission, requests · introduce: can / can’t for ability and permission; Can / Could you…? for polite requests | notice: Hostel information: what you can and can’t do (50–110 words)             | 4 today · 2 from d007, d002 | planned                |
| d010 | Meeting new people (relationships)        | Starting a conversation with someone new — e.g. introduce, stranger, chat                   | Questions: question words and word order · introduce: Wh- questions with present tenses: where, when, what time, how often, why       | dialogue: At a language café: getting to know someone (50–110 words)             | 4 today · 2 from d008, d003 | planned                |

### Chapter 2 · Momentum — Days 11–30 · A2+

Move from single sentences to connected descriptions: past events in order, plans and predictions, comparisons, advice and rules.

| Day  | Theme                                           | Vocabulary                                                               | Grammar                                                                                                                                     | Reading                                                              | Review                                    | Status  |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- | ------- |
| d011 | Last weekend (free-time)                        | Weekend activities and how they felt — e.g. stay in, go out, relaxing    | Past Simple · introduce: Past Simple of be (was / were) with yesterday, last…, …ago                                                         | message: How was your weekend? (chat) (90–170 words)                 | 4 today · 4 from d009, d004               | planned |
| d012 | A day at work (work)                            | Everyday work and study — e.g. meeting, deadline, break                  | Past Simple · practice: Regular verbs: -ed spelling and pronunciation                                                                       | workSituation: Aziza’s first week at a new office (90–170 words)     | 4 today · 4 from d010, d005               | planned |
| d013 | A trip to remember (travel)                     | Travelling by train and bus — e.g. ticket, luggage, miss (a train)       | Past Simple · practice: Common irregular verbs: went, saw, took, bought, had                                                                | travelNote: A weekend in Samarkand: a travel diary (90–170 words)    | 4 today · 4 from d011, d006               | planned |
| d014 | CHECKPOINT · Memories and moments (experience)  | Talking about memories — e.g. memory, moment, surprise                   | Week 2 exam: 12 questions over d008–d013                                                                                                    | —                                                                    | 2 today · 6 from the week                 | planned |
| d015 | At the doctor’s (health)                        | Feeling ill and getting better — e.g. headache, cough, medicine          | Past Simple · practice: Questions and negatives: Did you…? I didn’t…; When did it start?                                                    | dialogue: A visit to the doctor (90–170 words)                       | 4 today · 2 from d013, d008 · 2 from d001 | planned |
| d016 | A bad day (problems)                            | Small everyday problems — e.g. lose, queue, battery                      | Past Simple · consolidate: Telling a story in order: first, then, after that, finally                                                       | story: Everything went wrong on Monday (90–170 words)                | 4 today · 2 from d014, d009 · 2 from d002 | planned |
| d017 | In the kitchen (food)                           | Food and cooking — e.g. ingredient, vegetables, fridge                   | Countable and uncountable nouns; some, any, much, many · introduce: Countable and uncountable nouns; a / an, some, any (Is there any milk?) | informational: A simple recipe: vegetable soup (90–170 words)        | 4 today · 2 from d015, d010 · 2 from d003 | planned |
| d018 | At the market (shopping)                        | Buying and paying — e.g. price, cash, receipt                            | Countable and uncountable nouns; some, any, much, many · practice: much / many / a lot of; How much…? How many…?                            | dialogue: Buying fruit at the market (90–170 words)                  | 4 today · 2 from d016, d011 · 2 from d004 | planned |
| d019 | Choosing a phone (technology)                   | Describing products — e.g. light (weight), reliable, screen              | Comparatives · introduce: Comparatives: -er / more … than; better, worse                                                                    | opinion: Two customer reviews of two phones (90–170 words)           | 4 today · 2 from d017, d012 · 2 from d005 | planned |
| d020 | The best places in town (city)                  | Sights and places to visit — e.g. museum, crowded, famous                | Superlatives · introduce: Superlatives: the -est / the most; the best, the worst                                                            | blog: The top three places in my city (90–170 words)                 | 4 today · 2 from d018, d013 · 2 from d006 | planned |
| d021 | CHECKPOINT · Comparing and choosing (decisions) | Comparing options and choosing — e.g. compare, prefer, option            | Week 3 exam: 12 questions over d015–d020                                                                                                    | —                                                                    | 2 today · 6 from the week                 | planned |
| d022 | Weekend plans (future)                          | Making plans — e.g. invite, organise, picnic                             | be going to · introduce: be going to for plans and intentions                                                                               | message: Planning a picnic in a group chat (90–170 words)            | 4 today · 2 from d020, d015 · 2 from d001 | planned |
| d023 | Making arrangements (relationships)             | Arranging to meet — e.g. book (a table), cancel, available               | Present Continuous · practice: Present Continuous for fixed arrangements: I’m meeting Sara on Friday                                        | email: Arranging to meet an old friend (90–170 words)                | 4 today · 2 from d021, d016 · 2 from d002 | planned |
| d024 | Offers and promises (communication)             | Helping each other — e.g. offer, promise, lend                           | will · introduce: will for offers, promises and quick decisions: I’ll help you                                                              | dialogue: Moving house: friends offer to help (90–170 words)         | 4 today · 2 from d022, d017 · 2 from d003 | planned |
| d025 | Weather and plans (nature)                      | The weather — e.g. forecast, temperature, storm                          | will · contrast: will vs going to vs Present Continuous: predictions, plans, arrangements                                                   | informational: The weekend weather forecast (90–170 words)           | 4 today · 2 from d023, d018 · 2 from d004 | planned |
| d026 | Staying healthy (health)                        | Wellbeing — e.g. sleep, stress, healthy                                  | should: advice · introduce: should / shouldn’t for advice                                                                                   | problemSolution: Advice column: “I’m always tired” (90–170 words)    | 4 today · 2 from d024, d019 · 2 from d005 | planned |
| d027 | Rules at work (work)                            | People and rules at work — e.g. colleague, manager, uniform              | have to / must: obligation and rules · introduce: have to / don’t have to / must / mustn’t for rules and obligations                        | workSituation: First-day rules at a café (90–170 words)              | 4 today · 2 from d025, d020 · 2 from d006 | planned |
| d028 | CHECKPOINT · Planning ahead (future)            | Planning ahead and staying organised — e.g. priority, reminder, schedule | Week 4 exam: 12 questions over d022–d027                                                                                                    | —                                                                    | 2 today · 6 from the week                 | planned |
| d029 | What were you doing? (experience)               | Sudden events — e.g. suddenly, noise, power cut                          | Past Continuous · introduce: Past Continuous for actions in progress in the past: I was reading when…                                       | story: The night the lights went out (90–170 words)                  | 4 today · 2 from d027, d022 · 2 from d008 | planned |
| d030 | A travel problem (travel)                       | Problems at the airport and station — e.g. delay, passport, announcement | Past Continuous · contrast: Past Continuous vs Past Simple with when / while                                                                | personalExperience: The day I nearly missed my flight (90–170 words) | 4 today · 2 from d028, d023 · 2 from d009 | planned |

### Chapter 3 · Habit — Days 31–60 · B1-

Step into B1: experiences and change, past habits, possibility and real conditions, describing people, places and processes, opinions with reasons. Longer texts, meaning from context, less Russian.

| Day  | Theme                                           | Vocabulary                                                           | Grammar                                                                                                                                      | Reading                                                                              | Review                                    | Status  |
| ---- | ----------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- | ------- |
| d031 | Have you ever…? (experience)                    | Life experiences — e.g. abroad, adventure, try                       | Present Perfect · introduce: Present Perfect for experiences: Have you ever…? I’ve never…; been vs gone                                      | blog: Five things I’ve never done (150–260 words)                                    | 4 today · 2 from d029, d024 · 2 from d010 | planned |
| d032 | Getting things done (work)                      | Tasks, lists and replies — e.g. to-do list, reply, attachment        | Present Perfect · practice: just / already / yet with the Present Perfect                                                                    | email: A work email thread: “Have you sent it yet?” (150–260 words)                  | 4 today · 2 from d030, d025 · 2 from d011 | planned |
| d033 | Life changes (self)                             | Big changes in life — e.g. grow up, move (house), apartment          | Present Perfect · practice: for / since and How long…? with the Present Perfect                                                              | personalExperience: A new life in a new city (150–260 words)                         | 4 today · 2 from d031, d026 · 2 from d012 | planned |
| d034 | My English story (learning)                     | Learning a language — e.g. fluent, accent, course                    | Present Perfect · contrast: Present Perfect vs Past Simple: finished time (last year, in 2020) vs up to now                                  | story: Kamila’s English story: how it started and where she is now (150–260 words)   | 4 today · 2 from d032, d027 · 2 from d013 | planned |
| d035 | CHECKPOINT · Experience and change (experience) | Describing change over time — e.g. gradually, recently, develop      | Week 5 exam: 15 questions over d029–d034                                                                                                     | —                                                                                    | 2 today · 6 from the week                 | planned |
| d036 | How life used to be (culture)                   | Life then and now — e.g. childhood, village, traditional             | used to · introduce: used to / didn’t use to for past habits and states                                                                      | informational: How our city has changed in fifty years (150–260 words)               | 4 today · 2 from d034, d029 · 2 from d015 | planned |
| d037 | Likes and dislikes (free-time)                  | Hobbies and preferences — e.g. enjoy, avoid, hobby                   | Verb + -ing / verb + to-infinitive · introduce: Verb + -ing (enjoy, avoid, mind) and verb + to (decide, hope, want)                          | opinion: Forum: what do you enjoy doing after work? (150–260 words)                  | 4 today · 2 from d035, d030 · 2 from d016 | planned |
| d038 | Maybe, maybe not (decisions)                    | Being unsure — e.g. possible, probably, guess                        | may / might / could: possibility · introduce: may / might / could for possibility                                                            | dialogue: Friends deciding what to do on Saturday (150–260 words)                    | 4 today · 2 from d036, d031 · 2 from d017 | planned |
| d039 | Old friends (relationships)                     | Friendship over time — e.g. classmate, keep in touch, get on (with)  | used to · practice: used to vs Past Simple; didn’t use to; Did you use to…?                                                                  | message: “Remember when we used to…?” — messages between old friends (150–260 words) | 4 today · 2 from d037, d032 · 2 from d018 | planned |
| d040 | Spending and saving (money)                     | Spending and saving money — e.g. spend, save, afford                 | Verb + -ing / verb + to-infinitive · practice: Verb patterns with money and plans: decide to, can’t afford to, avoid spending, would like to | personalExperience: My no-spend month (150–260 words)                                | 4 today · 2 from d038, d033 · 2 from d019 | planned |
| d041 | Weekend options (free-time)                     | Things to do in your free time — e.g. exhibition, concert, outdoor   | may / might / could: possibility · practice: could / might for options and suggestions: We could…, It might be…                              | email: Choosing between two weekend trips (150–260 words)                            | 4 today · 2 from d039, d034 · 2 from d020 | planned |
| d042 | CHECKPOINT · Pros and cons (decisions)          | Weighing up options — e.g. advantage, disadvantage, worth            | Week 6 exam: 15 questions over d036–d041                                                                                                     | —                                                                                    | 2 today · 6 from the week                 | planned |
| d043 | How things work (technology)                    | Using devices — e.g. device, charge, app                             | Zero conditional · introduce: Zero conditional for facts and instructions: If you press…, it…                                                | informational: How to make your phone battery last longer (150–260 words)            | 4 today · 2 from d041, d036 · 2 from d022 | planned |
| d044 | Eating well (food)                              | Diet and fitness — e.g. diet, fitness, junk food                     | First conditional · introduce: First conditional: If + Present Simple, will — real results in the future                                     | problemSolution: Small changes, big results (150–260 words)                          | 4 today · 2 from d042, d037 · 2 from d023 | planned |
| d045 | Planning a trip (travel)                        | Booking and arriving — e.g. reservation, arrival, departure          | First conditional · practice: when / as soon as / unless / before / after + Present Simple for the future                                    | notice: Hotel information for arriving guests (150–260 words)                        | 4 today · 2 from d043, d038 · 2 from d024 | planned |
| d046 | People who help us (work)                       | Jobs that help others — e.g. nurse, volunteer, customer              | Relative clauses · introduce: Defining relative clauses with who / which / that                                                              | workSituation: The people who keep our office running (150–260 words)                | 4 today · 2 from d044, d039 · 2 from d025 | planned |
| d047 | Places with a story (city)                      | Describing places — e.g. historic, local, atmosphere                 | Relative clauses · practice: where and whose; leaving out that and which                                                                     | travelNote: A street where every house has a story (150–260 words)                   | 4 today · 2 from d045, d040 · 2 from d026 | planned |
| d048 | City or countryside? (nature)                   | City and countryside — e.g. countryside, pollution, fresh air        | Comparatives · practice: (not) as … as; much / a bit / far + comparative                                                                     | opinion: Why I moved to the countryside — and why my sister didn’t (150–260 words)   | 4 today · 2 from d046, d041 · 2 from d027 | planned |
| d049 | CHECKPOINT · Digital life (technology)          | Accounts, passwords and files — e.g. account, password, download     | Week 7 exam: 15 questions over d043–d048                                                                                                     | —                                                                                    | 2 today · 6 from the week                 | planned |
| d050 | Made in… (technology)                           | How things are made — e.g. factory, material, recycle                | The passive · introduce: Present Simple passive: is made / are produced                                                                      | informational: How paper is made and recycled (150–260 words)                        | 4 today · 2 from d048, d043 · 2 from d029 | planned |
| d051 | Great inventions (culture)                      | Inventions — e.g. invent, discover, century                          | The passive · practice: Past Simple passive: was invented / were built (by…)                                                                 | story: Who invented the bicycle? (150–260 words)                                     | 4 today · 2 from d049, d044 · 2 from d030 | planned |
| d052 | Online or face to face? (communication)         | Talking and texting — e.g. conversation, misunderstand, face to face | Linking ideas · introduce: because / so / but / although / however: reasons, results and contrast                                            | opinion: Is texting better than talking? (150–260 words)                             | 4 today · 2 from d050, d045 · 2 from d031 | planned |
| d053 | At the bank (money)                             | Banking — e.g. bank account, loan, cash machine                      | Indirect questions · introduce: Indirect questions: Could you tell me where…? Do you know if…?                                               | dialogue: Polite questions at the bank (150–260 words)                               | 4 today · 2 from d051, d046 · 2 from d032 | planned |
| d054 | Recent news (experience)                        | News and events — e.g. news, event, headline                         | Present Perfect · consolidate: Present Perfect for news, Past Simple for the details: Have you heard? It happened on…                        | message: Catching up with an old friend (150–260 words)                              | 4 today · 2 from d052, d047 · 2 from d033 | planned |
| d055 | Solving everyday problems (problems)            | Problems and solutions — e.g. solution, repair, complaint            | should: advice · practice: Advice and suggestions: should, could, Why don’t you…?, How about + -ing?                                         | problemSolution: Forum: my neighbour is too loud (150–260 words)                     | 4 today · 2 from d053, d048 · 2 from d034 | planned |
| d056 | CHECKPOINT · Getting help (problems)            | Getting help with a problem — e.g. contact, urgent, deal with        | Week 8 exam: 15 questions over d050–d055                                                                                                     | —                                                                                    | 2 today · 6 from the week                 | planned |
| d057 | How long have you been learning? (learning)     | Learning a skill — e.g. skill, method, revise                        | Present Perfect Continuous · introduce: Present Perfect Continuous: How long have you been…? I’ve been learning…                             | blog: I’ve been learning the guitar for a year (150–260 words)                       | 4 today · 2 from d055, d050 · 2 from d036 | planned |
| d058 | Going back to studying (work)                   | Studying as an adult — e.g. qualification, evening course, enrol     | Indirect questions · practice: Indirect questions in writing: I’d like to know whether…, Could you tell me when…?                            | email: Asking about an evening course (150–260 words)                                | 4 today · 2 from d056, d051 · 2 from d037 | planned |
| d059 | Goals for next month (future)                   | Setting goals — e.g. target, realistic, motivate                     | First conditional · consolidate: Real conditionals in plans: if / unless / as soon as                                                        | personalExperience: My plan for next month (150–260 words)                           | 4 today · 2 from d057, d052 · 2 from d038 | planned |
| d060 | Halfway there (growth)                          | Describing your progress — e.g. realise, manage, get better (at)     | Linking ideas · consolidate: Linking ideas in a short paragraph: reasons, results, contrast and purpose (to, so that)                        | blog: Sixty days of English: what worked for me (150–260 words)                      | 4 today · 2 from d058, d053 · 2 from d039 | planned |

### Chapter 4 · Growth — Days 61–89 · B1

Consolidate B1: imaginary situations, deductions, narrative tenses, reported speech and linked paragraphs, with 220–400-word texts read for main idea, detail, inference and context.

| Day  | Theme                                            | Vocabulary                                                                | Grammar                                                                                                                             | Reading                                                                         | Review                                    | Status                 |
| ---- | ------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------- |
| d061 | If I could… (decisions)                          | Dreams and wishes — e.g. dream, imagine, freedom                          | Second conditional · introduce: Second conditional for imaginary situations: If I had…, I would…                                    | blog: If I had a year off (220–400 words)                                       | 4 today · 2 from d059, d054 · 2 from d040 | planned                |
| d062 | A big decision (work)                            | Job choices — e.g. opportunity, consider, salary                          | Second conditional · contrast: Real or imaginary? The first vs the second conditional                                               | dialogue: Should I take the job in another city? (220–400 words)                | 4 today · 2 from d060, d055 · 2 from d041 | planned                |
| d063 | CHECKPOINT · Making decisions (decisions)        | Being sure and unsure — e.g. doubt, certain, hesitate                     | Week 9 exam: 15 questions over d057–d062                                                                                            | —                                                                               | 2 today · 6 from the week                 | planned                |
| d064 | Everyday mysteries (real-life)                   | Guessing and explaining — e.g. clue, obvious, strange                     | must / might / can't: deduction · introduce: must / might / can’t for deductions about the present                                  | story: The mystery of the missing keys (220–400 words)                          | 4 today · 2 from d062, d057 · 2 from d043 | planned                |
| d065 | Just in time (challenges)                        | Timing — e.g. rush, in time, eventually                                   | Past Perfect · introduce: Past Perfect: had + past participle for the earlier past                                                  | personalExperience: By the time I got to the station… (220–400 words)           | 4 today · 2 from d063, d058 · 2 from d044 | planned                |
| d066 | Success and failure (success)                    | Trying, failing and succeeding — e.g. succeed, attempt, failure           | Past Perfect · consolidate: Narrative tenses together: Past Simple, Past Continuous and Past Perfect                                | story: The athlete who never gave up (220–400 words)                            | 4 today · 2 from d064, d059 · 2 from d045 | planned                |
| d067 | What did they say? (communication)               | Reporting what people say — e.g. mention, complain, admit                 | Reported speech · introduce: Reported statements: said / told me that…, with the tense moving back                                  | workSituation: What was said at the team meeting (220–400 words)                | 4 today · 2 from d065, d060 · 2 from d046 | planned                |
| d068 | The job interview (work)                         | Job interviews — e.g. interview, strength, weakness                       | Reported speech · practice: Reported questions and requests: asked me if / why…; asked me to…                                       | personalExperience: They asked me why I wanted the job (220–400 words)          | 4 today · 2 from d066, d061 · 2 from d047 | planned                |
| d069 | Growing as a person (growth)                     | Personal growth — e.g. attitude, potential, mindset                       | may / might / could: possibility · practice: How sure are you? will probably, might, may not, definitely won’t — about your future  | blog: Where will I be in five years? (220–400 words)                            | 4 today · 2 from d067, d062 · 2 from d048 | planned                |
| d070 | CHECKPOINT · Learning from mistakes (challenges) | Mistakes and second chances — e.g. regret, recover, warning               | Week 10 exam: 15 questions over d064–d069                                                                                           | —                                                                               | 2 today · 6 from the week                 | planned                |
| d071 | The world in 2050 (future)                       | The future of the world — e.g. predict, population, electric              | will · consolidate: Future forms review: plans, arrangements, predictions and how sure you are                                      | informational: Five predictions about life in 2050 (220–400 words)              | 4 today · 2 from d069, d064 · 2 from d050 | planned                |
| d072 | Changing cities (city)                           | Changes in a city — e.g. public transport, pedestrian, construction       | The passive · practice: Passive with will and can: will be built, can be used                                                       | notice: City announcement: changes to the city centre (220–400 words)           | 4 today · 2 from d070, d065 · 2 from d051 | planned                |
| d073 | Traditions and festivals (culture)               | Traditions and celebrations — e.g. tradition, celebrate, custom           | Relative clauses · practice: Non-defining relative clauses with which / who and commas                                              | travelNote: My first Navruz in Tashkent (220–400 words)                         | 4 today · 2 from d071, d066 · 2 from d052 | planned                |
| d074 | Building better habits (habits)                  | Building and keeping habits — e.g. reward, stick to, track                | Present Perfect Continuous · contrast: Present Perfect Continuous vs Simple: I’ve been reading vs I’ve read                         | blog: I’ve been tracking my habits for thirty days (220–400 words)              | 4 today · 2 from d072, d067 · 2 from d053 | planned                |
| d075 | Under pressure (challenges)                      | Stress and difficulty — e.g. pressure, cope, tough                        | too / enough / so / such · introduce: too / enough, and so / such … that                                                            | personalExperience: The hardest week of my job (220–400 words)                  | 4 today · 2 from d073, d068 · 2 from d054 | planned                |
| d076 | Confidence and skills (growth)                   | Speaking in front of people — e.g. nervous, presentation, public speaking | Verb + -ing / verb + to-infinitive · practice: -ing after prepositions and as a subject: good at speaking; Learning English is…     | problemSolution: How to feel less nervous before a presentation (220–400 words) | 4 today · 2 from d074, d069 · 2 from d055 | planned                |
| d077 | CHECKPOINT · A changing world (culture)          | Society and change — e.g. society, generation, influence                  | Week 11 exam: 15 questions over d071–d076                                                                                           | —                                                                               | 2 today · 6 from the week                 | planned                |
| d078 | At the hotel reception (real-life)               | Hotels and services — e.g. check out, refund, facilities                  | Indirect questions · practice: Polite questions in services: Could you tell me…? I was wondering if…                                | dialogue: Checking in: a problem with the booking (220–400 words)               | 4 today · 2 from d076, d071 · 2 from d057 | planned                |
| d079 | Rules and responsibilities (work)                | Responsibilities at work — e.g. permission, require, policy               | have to / must: obligation and rules · consolidate: Obligation, necessity and advice: must, have to, need to, don’t need to, should | email: New rules for working from home (220–400 words)                          | 4 today · 2 from d077, d072 · 2 from d058 | planned                |
| d080 | Giving advice (relationships)                    | Getting on with people — e.g. apologise, trust, forgive                   | Second conditional · practice: If I were you, I’d…: advice with the second conditional                                              | problemSolution: Advice column: my best friend is angry with me (220–400 words) | 4 today · 2 from d078, d073 · 2 from d059 | planned                |
| d081 | Passing on messages (communication)              | Messages and instructions — e.g. remind, confirm, forward                 | Reported speech · consolidate: Passing on messages and instructions: told me to…, asked if…, said that…                             | workSituation: A message from the manager (220–400 words)                       | 4 today · 2 from d079, d074 · 2 from d060 | planned                |
| d082 | Healthy lifestyle (health)                       | Lifestyle — e.g. lifestyle, benefit, effect                               | Comparatives · consolidate: The more…, the better; comparing options in detail                                                      | opinion: The more you move, the better you feel? (220–400 words)                | 4 today · 2 from d080, d075 · 2 from d061 | planned                |
| d083 | A busy Saturday (home)                           | Everyday phrasal verbs — e.g. pick up, find out, look after               | Phrasal verbs · introduce: Common phrasal verbs; separable ones with pronouns: turn it off, pick her up                             | message: Messages between flatmates (220–400 words)                             | 4 today · 2 from d081, d076 · 2 from d062 | planned                |
| d084 | CHECKPOINT · Everyday situations (real-life)     | Sorting things out — e.g. arrange, sort out, on the way                   | Week 12 exam: 15 questions over d078–d083                                                                                           | —                                                                               | 2 today · 6 from the week                 | NEEDS_CONTENT_REVISION |
| d085 | Different points of view (culture)               | Discussing opinions — e.g. convince, fair, compromise                     | Linking ideas · consolidate: Organising an argument: first of all, on the other hand, in addition, in conclusion                    | opinion: Should everyone learn a second language? Two views (220–400 words)     | 4 today · 2 from d083, d078 · 2 from d064 | planned                |
| d086 | Keep going (habits)                              | Phrasal verbs for goals and habits — e.g. give up, put off, catch up      | Phrasal verbs · practice: Phrasal verbs for habits and goals: give up, keep on, put off, catch up                                   | blog: How I stopped putting things off (220–400 words)                          | 4 today · 2 from d084, d079 · 2 from d065 | planned                |
| d087 | Real-life challenges (challenges)                | Difficult situations — e.g. emergency, calm down, rescue                  | must / might / can't: deduction · consolidate: Modals review: ability, obligation, advice, possibility and deduction                | travelNote: A difficult journey home (220–400 words)                            | 4 today · 2 from d085, d080 · 2 from d066 | planned                |
| d088 | Who I am now (self)                              | Describing character — e.g. ambitious, honest, independent                | Present Perfect Continuous · consolidate: Present tenses review: simple, continuous, perfect and perfect continuous                 | personalExperience: Three months that changed me (220–400 words)                | 4 today · 2 from d086, d081 · 2 from d067 | planned                |
| d089 | Looking back and ahead (learning)                | Achievement and progress — e.g. achievement, progress, overcome           | Present Perfect · consolidate: Your story in tenses: used to, Past Simple, Present Perfect and the future                           | story: Small steps: Kamila looks back on her English (220–400 words)            | 4 today · 2 from d087, d082 · 2 from d068 | NEEDS_CONTENT_REVISION |

### Chapter 5 · Summit — Days 90–90 · B1

No new material: the Final Battle shows what the learner can do across the whole course.

| Day  | Theme                          | Vocabulary | Grammar                                          | Reading | Review | Status                 |
| ---- | ------------------------------ | ---------- | ------------------------------------------------ | ------- | ------ | ---------------------- |
| d090 | SUMMIT · The summit (learning) | —          | Final Battle: 20 questions over the whole course | —       | —      | NEEDS_CONTENT_REVISION |

<!-- /curriculum:day-map -->

## 9. Weekly exams

Twelve checkpoints, taken from the course plan (every seventh day). Each covers exactly the days
since the previous checkpoint, and the validator checks this against the plan. Exams grow with the
course: 9 questions in week 1, 12 in weeks 2–4, 15 from week 5. Themes, grammar and reading skills
below are worked out from the covered days. The objective and "must retain" are the exam's own:
what the learner should still know a week later. Exam questions carry `materialIds` for the
material they test.

<!-- curriculum:checkpoints -->

### Week 1 · d007 — Checking progress

- Objective: Talk about yourself, your routine and what is happening now with present tenses.
- Covers: d001–d006
- Questions: 9 — vocabulary 4, grammar 3, reading 2
- Themes: Learning & progress; Daily routine & time; Me & who I am; Home & everyday actions; Family, friends & relationships
- Grammar: Present Simple; Adverbs of frequency; Present Continuous
- Reading skills: main idea, detail, inference
- Must retain:
  - Present Simple, including he / she / it spelling and do / does questions
  - Adverbs of frequency in the right place
  - Present Simple vs Present Continuous
  - Words for learning, routines, personal information, time, home and family
- NEEDS_CONTENT_REVISION: The Week 1 exam and the Day 7 review draw only on Days 1–2, the only days written so far: widen both to Days 1–6 once those days exist.

### Week 2 · d014 — Memories and moments

- Objective: Describe places, ask for help and get to know people; say what happened at the weekend, at work or on a trip.
- Covers: d008–d013
- Questions: 12 — vocabulary 5, grammar 4, reading 3
- Themes: Town, city & places; Communication; Family, friends & relationships; Free time; Work & study; Travel & transport
- Grammar: There is / there are; can / could: ability, permission, requests; Questions: question words and word order; Past Simple
- Reading skills: main idea, detail, inference
- Must retain:
  - There is / there are with prepositions of place
  - can / could for ability, permission and requests
  - Wh- questions with present tenses
  - Past Simple: was / were, regular and common irregular verbs

### Week 3 · d021 — Comparing and choosing

- Objective: Tell a short story in order and ask about the past; talk about food, shopping and choosing between things.
- Covers: d015–d020
- Questions: 12 — vocabulary 5, grammar 4, reading 3
- Themes: Health & wellbeing; Problems & solutions; Food & eating; Shopping; Technology; Town, city & places
- Grammar: Past Simple; Countable and uncountable nouns; some, any, much, many; Comparatives; Superlatives
- Reading skills: main idea, detail, inference
- Must retain:
  - Past Simple questions and negatives
  - Sequencing a story: first, then, after that, finally
  - Countable and uncountable nouns with some / any / much / many
  - Comparatives and superlatives

### Week 4 · d028 — Planning ahead

- Objective: Talk about plans, arrangements and predictions; give advice and explain rules.
- Covers: d022–d027
- Questions: 12 — vocabulary 5, grammar 4, reading 3
- Themes: Plans, goals & the future; Family, friends & relationships; Communication; Weather & nature; Health & wellbeing; Work & study
- Grammar: be going to; Present Continuous; will; should: advice; have to / must: obligation and rules
- Reading skills: main idea, detail, inference
- Must retain:
  - going to, will and the Present Continuous for the future
  - should / shouldn’t for advice
  - have to / don’t have to / must / mustn’t
  - Words for plans, arrangements, weather, health and work

### Week 5 · d035 — Experience and change

- Objective: Tell stories with the Past Simple and Past Continuous; talk about experiences and life changes with the Present Perfect.
- Covers: d029–d034
- Questions: 15 — vocabulary 6, grammar 5, reading 4
- Themes: Experiences & memories; Travel & transport; Work & study; Me & who I am; Learning & progress
- Grammar: Past Continuous; Present Perfect
- Reading skills: main idea, detail, inference, context
- Must retain:
  - Past Continuous vs Past Simple with when / while
  - Present Perfect: ever / never, just / already / yet, for / since
  - Present Perfect vs Past Simple
  - Words for sudden events, travel problems, experiences, tasks and life changes

### Week 6 · d042 — Pros and cons

- Objective: Talk about how life used to be, what you like and choose to do, and what might happen.
- Covers: d036–d041
- Questions: 15 — vocabulary 6, grammar 5, reading 4
- Themes: Culture & society; Free time; Choices & decisions; Family, friends & relationships; Money
- Grammar: used to; Verb + -ing / verb + to-infinitive; may / might / could: possibility
- Reading skills: main idea, detail, inference, context
- Must retain:
  - used to / didn’t use to vs the Past Simple
  - Verb + -ing and verb + to-infinitive
  - may / might / could for possibility and options
  - Words for life then and now, hobbies, friendship, money and free time

### Week 7 · d049 — Digital life

- Objective: Explain how things work and what will happen if…; describe people and places precisely; compare in more detail.
- Covers: d043–d048
- Questions: 15 — vocabulary 6, grammar 5, reading 4
- Themes: Technology; Food & eating; Travel & transport; Work & study; Town, city & places; Weather & nature
- Grammar: Zero conditional; First conditional; Relative clauses; Comparatives
- Reading skills: main idea, detail, inference, context
- Must retain:
  - Zero and first conditionals, with when / as soon as / unless
  - Defining relative clauses: who, which, that, where, whose
  - (not) as … as and much / a bit + comparative
  - Words for devices, food and fitness, trips, jobs, places and the countryside

### Week 8 · d056 — Getting help

- Objective: Describe how things are made and were invented, give reasons and contrast, ask politely and give advice.
- Covers: d050–d055
- Questions: 15 — vocabulary 6, grammar 5, reading 4
- Themes: Technology; Culture & society; Communication; Money; Experiences & memories; Problems & solutions
- Grammar: The passive; Linking ideas; Indirect questions; Present Perfect; should: advice
- Reading skills: main idea, detail, inference, context
- Must retain:
  - Present and past passive
  - because / so / although / however
  - Indirect questions
  - Present Perfect for news, Past Simple for the details
  - Advice and suggestions: should, could, Why don’t you…?, How about…?

### Week 9 · d063 — Making decisions

- Objective: Say how long you have been doing things, plan with real conditions, link ideas, and imagine situations with the second conditional.
- Covers: d057–d062
- Questions: 15 — vocabulary 6, grammar 5, reading 4
- Themes: Learning & progress; Work & study; Plans, goals & the future; Personal growth & confidence; Choices & decisions
- Grammar: Present Perfect Continuous; Indirect questions; First conditional; Linking ideas; Second conditional
- Reading skills: main idea, detail, inference, context
- Must retain:
  - Present Perfect Continuous
  - Indirect questions in writing
  - Real conditionals in plans: if / unless / as soon as
  - Linking reasons, results, contrast and purpose
  - Second conditional; first vs second

### Week 10 · d070 — Learning from mistakes

- Objective: Make deductions, tell stories with narrative tenses, report what people said and asked, and talk about the future with degrees of certainty.
- Covers: d064–d069
- Questions: 15 — vocabulary 6, grammar 5, reading 4
- Themes: Real-life situations; Challenges & pressure; Success & failure; Communication; Work & study; Personal growth & confidence
- Grammar: must / might / can't: deduction; Past Perfect; Reported speech; may / might / could: possibility
- Reading skills: main idea, detail, inference, context
- Must retain:
  - must / might / can’t for deduction
  - Past Perfect and narrative tenses
  - Reported statements, questions and requests
  - will probably / might / may not for certainty
  - Words for mysteries, timing, success, reporting, interviews and personal growth

### Week 11 · d077 — A changing world

- Objective: Talk about the future and changing cities, describe traditions, habits and pressure, and use -ing forms confidently.
- Covers: d071–d076
- Questions: 15 — vocabulary 6, grammar 5, reading 4
- Themes: Plans, goals & the future; Town, city & places; Culture & society; Habits & lifestyle; Challenges & pressure; Personal growth & confidence
- Grammar: will; The passive; Relative clauses; Present Perfect Continuous; too / enough / so / such; Verb + -ing / verb + to-infinitive
- Reading skills: main idea, detail, inference, context
- Must retain:
  - Future forms review, with how sure you are
  - Passive with will and can
  - Non-defining relative clauses
  - Present Perfect Simple vs Continuous
  - too / enough; so / such … that
  - -ing after prepositions and as a subject

### Week 12 · d084 — Everyday situations

- Objective: Handle real-life situations: polite questions, rules and responsibilities, advice, passing on messages, comparing lifestyles and everyday phrasal verbs.
- Covers: d078–d083
- Questions: 15 — vocabulary 6, grammar 5, reading 4
- Themes: Real-life situations; Work & study; Family, friends & relationships; Communication; Health & wellbeing; Home & everyday actions
- Grammar: Indirect questions; have to / must: obligation and rules; Second conditional; Reported speech; Comparatives; Phrasal verbs
- Reading skills: main idea, detail, inference, context
- Must retain:
  - Polite indirect questions
  - must / have to / need to / should
  - If I were you, I’d…
  - Reported speech in messages and instructions
  - The more…, the more…
  - Common phrasal verbs
- NEEDS_CONTENT_REVISION: The Week 12 exam predates the curriculum: it tests the Present Perfect Continuous, the first conditional, used to and verb patterns with learning vocabulary — topics of Days 36–57, not Days 78–83. Rewrite it for the objectives above and add materialIds.

<!-- /curriculum:checkpoints -->

## 10. Final Battle

Day 90 teaches nothing new. The Final Battle checks the whole way up by what it measures:
vocabulary retention, grammar in use, reading comprehension, and context and inference. It never
tries to ask about every item. It reuses the daily quests' kinds of exercise. Context and inference
are asked through the existing sections: one word-in-context question and two inference questions.
Questions come from material that was reviewed, weighted by chapter.

<!-- curriculum:final -->

- Objective: Show what 90 days built: core vocabulary remembered, grammar used in context, everyday B1 texts understood, meaning worked out from context.
- Questions: 20, 2 reading passages
- Measures: vocabulary retention 6 · grammar application 6 · reading comprehension 5 · context and inference 3
- Sections: vocabulary 7 · grammar 6 · reading 7
- Chapters: Beginning 3 · Momentum 5 · Habit 6 · Growth 6
- Grammar strands, one question each:
  - Present and past tenses: Present Simple, Present Continuous, Past Simple, Past Continuous, Past Perfect
  - Present Perfect: Present Perfect, Present Perfect Continuous
  - The future: be going to, will
  - Modals: can / could: ability, permission, requests, should: advice, have to / must: obligation and rules, may / might / could: possibility, must / might / can't: deduction
  - Conditionals: Zero conditional, First conditional, Second conditional
  - Complex sentences: Relative clauses, The passive, Reported speech, Linking ideas
- NEEDS_CONTENT_REVISION: The written Final Battle predates the curriculum: its source days do not match where material is taught (the Present Continuous on Day 15, “give up” on Day 23, comparatives on Day 52) and it is balanced V8 / G7 / R5. Re-source every question from the day map and rebalance to V7 / G6 / R7: 6 retention, 6 grammar, 5 comprehension, 3 context or inference.

<!-- /curriculum:final -->

## 11. Learning outcomes

Measurable and realistic: what the learner can do, never "speaks fluently".

<!-- curriculum:outcomes -->

### d010 · After Chapter 1 · Beginning

- Introduce yourself and others: hometown, work or studies, personality, family.
- Describe your routine and how often you do things (Present Simple, always … never).
- Say what is happening now and contrast it with what usually happens.
- Ask and answer everyday questions: do / does, where, when, what time, how often.
- Say where places are (there is / there are with prepositions) and make polite requests (Can / Could you…?).
- Read a 50–110-word message, profile or notice and find its main idea and key details.
- Has met about 60 new words.

### d030 · After Chapter 2 · Momentum

- Tell a short story about a weekend, a trip or a problem in the right order (Past Simple, Past Continuous; first, then, finally).
- Talk about plans, arrangements and predictions (going to, Present Continuous, will).
- Compare products and places, and talk about quantities when shopping and cooking.
- Give simple advice and explain rules (should, have to, must).
- Understand 90–170-word messages, emails, dialogues and reviews: main idea, details, simple inferences.
- Has met about 180 new words and recognises most of them in context.

### d060 · After Chapter 3 · Habit

- Talk about experiences, recent news and life changes (Present Perfect with for / since, vs Past Simple; Present Perfect Continuous).
- Describe how life used to be and what you like or choose to do (used to; verb + -ing / to).
- Talk about possibilities and real conditions (may, might, could; zero and first conditionals; unless, as soon as).
- Describe people, places and processes (relative clauses; present and past passive).
- Give an opinion with reasons and contrast (because, so, although, however) and ask polite indirect questions.
- Read 150–260-word texts for the main idea, details, opinions and the meaning of a word from context.
- Has met about 360 new words.

### d089 · After Chapter 4 · Growth

- Talk about imaginary situations and give advice (second conditional; If I were you…).
- Make deductions (must, might, can't) and tell stories with narrative tenses, including the Past Perfect.
- Report what people said, asked and told you to do.
- Link ideas into a short, organised paragraph and use common phrasal verbs.
- Read 220–400-word B1 texts for main idea, detail, inference and context.
- Has met about 530 new words, the core of them reviewed at least four times.

### d090 · At the summit

- Passes the Final Battle (70%): vocabulary retention, grammar in context, reading comprehension and inference from all four chapters.
- Works at a solid A2+ moving into B1: B1 in understanding everyday texts and core B1 grammar, not yet consistent B1 in free speaking or writing.
- Has a daily habit of about 20 minutes of English.

<!-- /curriculum:outcomes -->

## 12. Existing content against the map

The representative content was written before the curriculum. The Day 89 development scenario
does not dictate the programme. Where the written content does not fit, the map marks it
**NEEDS_CONTENT_REVISION**; it is not rewritten in this stage.

| Content          | Verdict                                            | Notes                                                                                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day 1            | fits                                               | Starting the journey; Present Simple for habits (A1 refresher on an A2 day); 57-word story; review on today only, as planned for Day 1. Two words (habit, confident) sit near B1 — acceptable as the course's own vocabulary.                                                                      |
| Day 2            | fits                                               | Morning routine; he/she/it spelling; 65-word story; review 4 today + 2 from Day 1, as planned.                                                                                                                                                                                                     |
| Day 7            | NEEDS_CONTENT_REVISION (once Days 3–6 are written) | The six checkpoint words fit. The review draws on Days 1–2 only, because nothing else existed: widen it to the whole week.                                                                                                                                                                         |
| Week 1 exam      | NEEDS_CONTENT_REVISION (once Days 3–6 are written) | Shape fits (9 questions: 4 vocabulary, 3 grammar, 2 reading, with materialIds). It covers Days 1–2; the curriculum covers Days 1–6.                                                                                                                                                                |
| Week 12 exam     | NEEDS_CONTENT_REVISION                             | Shape fits (15 questions: 6 / 5 / 4). The content tests topics of Days 36–57 (Present Perfect Continuous, first conditional, used to, verb patterns) with learning vocabulary, not the objectives of Days 78–83; it has no materialIds.                                                            |
| Day 89           | NEEDS_CONTENT_REVISION                             | The words (achievement, progress, overcome…) and the 374-word story fit "Looking back and ahead". The grammar lesson introduces Present Perfect vs Past Simple as new material: that contrast is Day 34. Day 89 should consolidate the tenses of the learner's story. Its review uses Day 89 only. |
| Final Battle     | NEEDS_CONTENT_REVISION                             | Structure fits (20 questions, 2 passages, all chapters). Its source days do not match where the map teaches the material, and it is balanced 8 / 7 / 5 instead of 7 / 6 / 7 (no context question in vocabulary, fewer reading inferences).                                                         |
| Day 90 (the day) | fits                                               | The summit is the Final Battle alone, as the course plan defines it.                                                                                                                                                                                                                               |

The development scenarios keep working after these revisions: they read Day 89 and the exams
through the repository, whatever their content is.

## 13. Stats

<!-- curriculum:stats -->

| Chapter   | Band | Days | Lesson days | Checkpoints | New words |
| --------- | ---- | ---- | ----------- | ----------- | --------- |
| Beginning | A2   | 10   | 9           | 1           | 60        |
| Momentum  | A2+  | 20   | 17          | 3           | 120       |
| Habit     | B1-  | 30   | 26          | 4           | 180       |
| Growth    | B1   | 29   | 25          | 4           | 174       |
| Summit    | B1   | 1    | 0           | 0           | 0         |

- Days: 90 — 77 lesson days, 12 checkpoints, 1 summit
- New words planned: 534
- Grammar: 32 topics over 77 lessons — introduce 32, practice 26, contrast 6, consolidate 13; each topic comes back 1–17 times (average 3.6)
- Reading genres: story 9, dialogue 8, message 6, email 6, blog 9, travelNote 5, workSituation 5, personalExperience 8, informational 7, notice 3, problemSolution 5, opinion 6
- Difficulty: A2 10 days, A2+ 20 days, B1- 30 days, B1 30 days
- Themes: 26 families, 19 of them come back in another chapter
- Review exercises: 52% today, 26% recent, 22% older
- NEEDS_CONTENT_REVISION: d007, d084, d089, d090

<!-- /curriculum:stats -->

## 14. Pedagogical audit

Questions asked of the map, and what they found:

- **Does difficulty grow too fast?**
  - No band moves everything at once. Text length grows about 60% per band; Russian steps back in
    stages.
  - New grammar is capped at three topics a week from Week 5. Weeks 2 and 4 introduce four each,
    but those are A2 topics, several of them refreshers for an A2 learner (there is / are, can).
  - The last five lesson days only consolidate.
- **Is there repetition?** Every item is planned for at least four encounters (§4). Grammar topics
  come back 1–17 times, 3.6 on average.
- **Ten similar themes in a row?** No: no family twice in a row (validated). 26 families; 19 come
  back in another chapter.
- **Is grammar overloaded?** 32 topics for an A2 → B1 course is in line with a pre-intermediate
  syllabus. 58% of grammar days practise, contrast or consolidate rather than introduce. B2 items
  are excluded.
- **Are readings varied?** Twelve genres, 3–9 of each; stories are 9 of 77.
- **Is Chapter 1 easier than Chapter 4?** Yes, on every axis:
  - texts of 50–110 vs 220–400 words;
  - A1–A2 topics vs B1 topics;
  - three questions vs four or five;
  - full Russian support vs English-first.
- **Do a day's vocabulary, grammar and reading connect?** Every day has one theme. The text topic
  is chosen to use the day's structure (a group chat in the Present Continuous on Day 5, a travel
  diary in the Past Simple on Day 13, hotel information with "as soon as you arrive…" on Day 45).
- **Do weekly exams follow the week?** Their coverage, themes, grammar and reading skills are
  derived from the covered days, and the coverage is validated against the plan.
- **Does the Final Battle fit the whole course?**
  - It weights chapters 3 · 5 · 6 · 6, by what each taught.
  - It samples six grammar strands, one question each.
  - It measures retention, grammar, comprehension and inference.

Fixed during the audit:

1. Week 6 first had five new B1 topics (used to, verb patterns, possibility, zero and first
   conditionals). The conditionals moved to Week 7 and the passive and linkers to Week 8: at most
   three new topics a week in Chapter 3.
2. too / enough / so / such moved from Chapter 3 to Day 75, relieving Week 7.
3. Present Perfect vs Past Simple sits on Day 34, after the Present Perfect is introduced and
   practised — not on Day 89, where the development scenario had put it.
4. Two informational texts that ran back to back in Chapter 4 became a notice and a travel note.
   Two "trip" themes in Week 6 became "Weekend options" and "Planning a trip".
5. The Final Battle blueprint adds reading inference and a word in context (7 / 6 / 7).

Known trade-offs, to watch with real learners:

- Checkpoint days still teach six new words on exam day (the existing mechanic); four could be
  lighter, if exam days feel heavy.
- CEFR tags on material are the author's judgement; the bands refine them but do not replace a
  pilot.
- Shopping and home appear twice at most; money, food and technology carry the everyday-spending
  topics later.

## 15. Writing content from this map

For each day:

1. **Read the day's row and its band profile** (§2): length, questions, review size, Russian
   support.
2. **Vocabulary:** six new words in the day's focus, including the anchors. Never a word another
   day teaches; translations follow the band's Russian support.
3. **Grammar:** a lesson on the day's topic and stage. Use only structures introduced before the
   day; the examples use the day's words.
4. **Reading:** the planned genre and topic, a length in the band's range, and questions that check
   the planned skills. Recycle words from the last week, and at least one older word.
5. **Review:** follow the planned mix and days: today, recent, older.
6. **Checkpoints:**
   - questions by the planned sections;
   - every question draws on the covered days and carries `materialIds`;
   - the objective and "must retain" decide what is asked.
7. **Final Battle:** follow the blueprint (§10).
8. **Validate and publish:**
   - run `npm run content:validate` and fix every error;
   - read the warnings (they flag drift);
   - clear the day's `revision` flag once it is fixed;
   - run `npm run curriculum:doc`.
