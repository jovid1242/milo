import { Check, Lock, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Sheet, StatsRow, type Stat } from '@/components/ui';
import { getWeekForDay } from '@/features/challenge/logic/calendar';
import type { Chapter, JourneyDay } from '@/schemas';
import { spacing } from '@/theme';

import {
  chapterLine,
  completedOn,
  dayStatus,
  examCopy,
  type DayStatus,
  type ExamCopy,
} from '../logic/day-copy';

export type DayDetailsSheetProps = {
  /** `null` closes the sheet. */
  day: JourneyDay | null;
  today: JourneyDay;
  chapters: readonly Chapter[];
  onClose: () => void;
  /** Today's quests live on Home: the map never starts a daily quest itself. */
  onContinueToday: () => void;
  onOpenTodaySummary: () => void;
  /** Exams are milestones of the map: they open from here too. */
  onOpenExam: (questId: string) => void;
  /** The finale, seen again once the summit is reached (nothing is paid twice). */
  onOpenSummit: () => void;
};

const BADGE_TONES: Record<DayStatus['tone'], 'brand' | 'reward' | 'neutral'> = {
  done: 'brand',
  today: 'reward',
  missed: 'neutral',
  locked: 'neutral',
};

const EXAM_TONES: Record<ExamCopy['tone'], 'brand' | 'reward' | 'neutral' | 'wood'> = {
  passed: 'reward',
  open: 'brand',
  retry: 'wood',
  locked: 'neutral',
  missed: 'neutral',
};

const EXAM_ICONS: Partial<Record<ExamCopy['tone'], LucideIcon>> = {
  passed: Check,
  retry: RotateCcw,
  locked: Lock,
};

function kindLine(day: JourneyDay): string | null {
  switch (day.kind) {
    case 'weeklyExam':
      return `Weekly exam · Week ${getWeekForDay(day.day)}`;
    case 'chapterEnd':
      return 'Chapter milestone';
    case 'summit':
      return 'Summit · Final challenge';
    case 'regular':
      return null;
  }
}

/** A day's details, from stored facts only; the call to action follows the day's state. */
export function DayDetailsSheet({
  day,
  today,
  chapters,
  onClose,
  onContinueToday,
  onOpenTodaySummary,
  onOpenExam,
  onOpenSummit,
}: DayDetailsSheetProps) {
  // Keeps showing the last day while the sheet slides away.
  const [shown, setShown] = useState(day);
  if (day && day !== shown) setShown(day);

  const chapter = shown ? chapters.find((item) => item.id === shown.chapterId) : undefined;
  const status = shown ? dayStatus(shown, today) : null;
  const exam = shown?.exam ? examCopy(shown.exam, shown) : null;
  const examAction =
    exam?.action && shown?.exam ? { ...exam.action, id: shown.exam.questId } : null;
  const facts: Stat[] = [];
  if (shown && shown.completedQuestCount > 0) {
    facts.push({ label: 'quests', value: `${shown.completedQuestCount}/${shown.questCount}` });
  }
  if (shown?.xpEarned) facts.push({ label: 'XP earned', value: `+${shown.xpEarned}` });

  return (
    <Sheet visible={day !== null} onClose={onClose} closeLabel="Close day details">
      {shown && chapter && status ? (
        <View style={styles.body} testID="journey-day-sheet">
          <View style={styles.titles}>
            <AppText variant="overline" color="wood">
              {chapterLine(chapter)}
            </AppText>
            <AppText variant="title1" accessibilityRole="header">
              {`Day ${shown.day}`}
            </AppText>
            {kindLine(shown) ? (
              <AppText variant="bodyStrong" color="secondary">
                {kindLine(shown)}
              </AppText>
            ) : null}
          </View>

          <View style={styles.status}>
            <Badge
              label={status.label}
              tone={BADGE_TONES[status.tone]}
              icon={status.tone === 'done' ? Check : status.tone === 'locked' ? Lock : undefined}
            />
            {status.detail ? (
              <AppText variant="body" color="secondary">
                {status.detail}
              </AppText>
            ) : null}
          </View>

          {exam ? (
            <View style={styles.exam} testID="journey-exam-status">
              <Badge label={exam.label} tone={EXAM_TONES[exam.tone]} icon={EXAM_ICONS[exam.tone]} />
              <AppText variant="body" color="secondary">
                {exam.detail}
              </AppText>
            </View>
          ) : null}

          {facts.length > 0 ? <StatsRow stats={facts} /> : null}
          {shown.completedAt ? (
            <AppText variant="caption" color="tertiary">
              {completedOn(shown.completedAt)}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            {examAction ? (
              <Button
                label={examAction.label}
                variant={examAction.primary ? 'primary' : 'secondary'}
                onPress={() =>
                  examAction.target === 'summit' ? onOpenSummit() : onOpenExam(examAction.id)
                }
                fullWidth
                testID="journey-open-exam"
              />
            ) : null}
            {shown.isToday && shown.state === 'available' && !examAction ? (
              <Button label="Continue today's journey" onPress={onContinueToday} fullWidth />
            ) : null}
            {shown.isToday && shown.state === 'completed' ? (
              <Button
                label="See today's summary"
                variant="secondary"
                onPress={onOpenTodaySummary}
                fullWidth
              />
            ) : null}
            <Button label="Close" variant="ghost" onPress={onClose} fullWidth haptic={null} />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[5] },
  titles: { gap: spacing[1] },
  status: { gap: spacing[2] },
  exam: { gap: spacing[2] },
  actions: { gap: spacing[2] },
});
