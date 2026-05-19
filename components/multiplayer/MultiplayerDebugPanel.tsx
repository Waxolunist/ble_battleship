import { DEV_SHOW_MULTIPLAYER_DEBUG } from '@/constants/dev';
import { Fonts, GameColors } from '@/constants/theme';
import {
  multiplayerDebugLog,
  type MultiplayerDebugEntry,
  type MultiplayerDebugLevel,
} from '@/services/multiplayer-debug-log';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * On-device multiplayer event log overlay. Dev-only (gated by DEV_SHOW_MULTIPLAYER_DEBUG).
 * Floats over the active screen so you can watch the host/join/connect/TX/RX
 * stream live, without tethering to Metro or logcat.
 *
 * Tap the header to expand/collapse. Tap CLEAR to wipe the buffer.
 */
export function MultiplayerDebugPanel() {
  const [entries, setEntries] = useState<MultiplayerDebugEntry[]>(() =>
    multiplayerDebugLog.getAll(),
  );
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    return multiplayerDebugLog.subscribe(setEntries);
  }, []);

  useEffect(() => {
    if (!collapsed) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [entries, collapsed]);

  if (!DEV_SHOW_MULTIPLAYER_DEBUG) return null;

  const counts = countByLevel(entries);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        <Pressable onPress={() => setCollapsed(c => !c)} style={styles.header}>
          <Text style={styles.headerTitle}>MP · {entries.length}</Text>
          <Text style={styles.headerCounts}>
            <Text style={styles.txTag}>tx {counts.tx}</Text>
            <Text> </Text>
            <Text style={styles.rxTag}>rx {counts.rx}</Text>
            <Text> </Text>
            <Text style={styles.errTag}>err {counts.error}</Text>
          </Text>
          <Pressable
            hitSlop={6}
            onPress={e => {
              e.stopPropagation();
              multiplayerDebugLog.clear();
            }}>
            <Text style={styles.clearText}>CLEAR</Text>
          </Pressable>
          <Text style={styles.chevron}>{collapsed ? '▴' : '▾'}</Text>
        </Pressable>
        {!collapsed && (
          <ScrollView
            ref={scrollRef}
            style={styles.log}
            contentContainerStyle={styles.logContent}
            onContentSizeChange={() => {
              scrollRef.current?.scrollToEnd({ animated: false });
            }}>
            {entries.length === 0 ? (
              <Text style={styles.empty}>no events yet — tap HOST or JOIN</Text>
            ) : (
              entries.map(entry => <LogRow key={entry.id} entry={entry} />)
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function LogRow({ entry }: { entry: MultiplayerDebugEntry }) {
  const time = formatTime(entry.ts);
  const tag = levelTag(entry.level);
  return (
    <View style={styles.row}>
      <Text style={styles.timeText}>{time}</Text>
      <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.eventText}>{entry.event}</Text>
        {entry.detail ? (
          <Text style={styles.detailText} numberOfLines={2}>
            {entry.detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function countByLevel(entries: MultiplayerDebugEntry[]): Record<MultiplayerDebugLevel, number> {
  const acc: Record<MultiplayerDebugLevel, number> = {
    info: 0,
    tx: 0,
    rx: 0,
    event: 0,
    warn: 0,
    error: 0,
  };
  for (const e of entries) acc[e.level]++;
  return acc;
}

function levelTag(level: MultiplayerDebugLevel): { label: string; color: string } {
  switch (level) {
    case 'tx':
      return { label: 'TX', color: GameColors.gold };
    case 'rx':
      return { label: 'RX', color: GameColors.previewValid };
    case 'event':
      return { label: '··', color: GameColors.labelBright };
    case 'warn':
      return { label: '!!', color: GameColors.fireGold };
    case 'error':
      return { label: 'ER', color: GameColors.red };
    case 'info':
    default:
      return { label: 'ok', color: GameColors.labelDim };
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 9999,
    elevation: 9999,
  },
  panel: {
    backgroundColor: GameColors.confirmDialogBg,
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GameColors.blueBorderDim,
  },
  headerTitle: {
    color: GameColors.gold,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerCounts: {
    flex: 1,
    color: GameColors.labelDim,
    fontFamily: Fonts.mono,
    fontSize: 10,
  },
  txTag: {
    color: GameColors.gold,
  },
  rxTag: {
    color: GameColors.previewValid,
  },
  errTag: {
    color: GameColors.red,
  },
  clearText: {
    color: GameColors.labelDim,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  chevron: {
    color: GameColors.labelBright,
    fontSize: 12,
    width: 14,
    textAlign: 'right',
  },
  log: {
    maxHeight: 180,
  },
  logContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  empty: {
    color: GameColors.labelDim,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 1,
  },
  timeText: {
    color: GameColors.labelFaded,
    fontFamily: Fonts.mono,
    fontSize: 9,
    width: 78,
  },
  tagText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    width: 18,
  },
  rowBody: {
    flex: 1,
  },
  eventText: {
    color: GameColors.label,
    fontFamily: Fonts.mono,
    fontSize: 10,
  },
  detailText: {
    color: GameColors.labelDim,
    fontFamily: Fonts.mono,
    fontSize: 9,
  },
});
