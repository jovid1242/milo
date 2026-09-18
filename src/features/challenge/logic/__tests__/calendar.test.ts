import { CHAPTERS } from '@/data/content/chapters';
import {
  findChapterForDay,
  getChallengeDay,
  getDayKind,
  getStartDateForDay,
  getWeekForDay,
} from '@/features/challenge/logic/calendar';

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

describe('day structure', () => {
  it('maps days to weeks', () => {
    expect(getWeekForDay(1)).toBe(1);
    expect(getWeekForDay(7)).toBe(1);
    expect(getWeekForDay(8)).toBe(2);
  });

  it('marks exam days and the summit', () => {
    expect(getDayKind(1)).toBe('regular');
    expect(getDayKind(7)).toBe('weeklyExam');
    expect(getDayKind(84)).toBe('weeklyExam');
    expect(getDayKind(89)).toBe('regular');
    expect(getDayKind(90)).toBe('summit');
  });

  it('finds the chapter that covers a day', () => {
    expect(findChapterForDay(CHAPTERS, 1).id).toBe('beginning');
    expect(findChapterForDay(CHAPTERS, 11).id).toBe('momentum');
    expect(findChapterForDay(CHAPTERS, 31).id).toBe('habit');
    expect(findChapterForDay(CHAPTERS, 89).id).toBe('growth');
    expect(findChapterForDay(CHAPTERS, 90).id).toBe('summit');
  });
});
