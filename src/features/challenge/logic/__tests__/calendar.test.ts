import { LOCAL_COURSE } from '@/content/course';
import { CHAPTERS } from '@/content/course/chapters';
import {
  findChapterForDay,
  getChallengeDay,
  getStartDateForDay,
} from '@/features/challenge/logic/calendar';

const dayOf = (day: number) => LOCAL_COURSE.days[day - 1];

const at = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12, 0, 0);

describe('getChallengeDay', () => {
  it('counts calendar days from the start date', () => {
    expect(getChallengeDay('2026-09-01', at(2026, 9, 1))).toBe(1);
    expect(getChallengeDay('2026-09-01', at(2026, 9, 12))).toBe(12);
  });

  it('clamps to the challenge range', () => {
    expect(getChallengeDay('2026-09-01', at(2026, 8, 20))).toBe(1);
    expect(getChallengeDay('2026-09-01', at(2027, 9, 1))).toBe(90);
  });

  it('round-trips with getStartDateForDay', () => {
    const now = at(2026, 9, 18);
    for (const day of [1, 7, 42, 90]) {
      expect(getChallengeDay(getStartDateForDay(day, now), now)).toBe(day);
    }
  });
});

describe('day structure (declared by the course)', () => {
  it('maps days to weeks', () => {
    expect(dayOf(1)?.week).toBe(1);
    expect(dayOf(7)?.week).toBe(1);
    expect(dayOf(8)?.week).toBe(2);
  });

  it('marks exam days and the summit', () => {
    expect(dayOf(1)?.kind).toBe('regular');
    expect(dayOf(7)?.kind).toBe('weeklyExam');
    expect(dayOf(84)?.kind).toBe('weeklyExam');
    expect(dayOf(89)?.kind).toBe('regular');
    expect(dayOf(90)?.kind).toBe('summit');
  });

  it('finds the chapter that covers a day', () => {
    expect(findChapterForDay(CHAPTERS, 1).id).toBe('beginning');
    expect(findChapterForDay(CHAPTERS, 11).id).toBe('momentum');
    expect(findChapterForDay(CHAPTERS, 31).id).toBe('habit');
    expect(findChapterForDay(CHAPTERS, 89).id).toBe('growth');
    expect(findChapterForDay(CHAPTERS, 90).id).toBe('summit');
  });
});
