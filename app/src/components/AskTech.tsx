import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { aiAsk, aiEnabled, isLimit } from "../lib/ai";
import { colors, fonts } from "../theme";
import { Icon } from "./Icon";
import { Press, SOFT, tap } from "./ui";

// The suggested questions are worded the same for everyone, so the server answers each one once per composition.
const SUGGEST = [
  "Подойдёт для чувствительной кожи?",
  "Можно при беременности?",
  "Можно каждый день?",
  "С чем не сочетать?",
];

/** «Спросить технолога»: a question about this product, a short answer from the light model. */
export function AskTech({ title, items }: { title: string; items: string[] }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<
    { q: string; a: string; error?: boolean }[]
  >([]);
  if (!aiEnabled || !items.length) return null;

  const ask = async (text: string) => {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    tap();
    setBusy(true);
    setQ("");
    try {
      const { text: a } = await aiAsk(title, items, question);
      setAnswers((l) => [
        { q: question, a: a || "Технолог не смог ответить по этому составу." },
        ...l,
      ]);
    } catch (e) {
      const a = isLimit(e)
        ? "На сегодня вопросы технологу закончились — завтра лимит обновится."
        : "Не получилось спросить — проверьте интернет и попробуйте ещё раз.";
      setAnswers((l) => [{ q: question, a, error: true }, ...l]);
    }
    setBusy(false);
  };
  const asked = answers.map((x) => x.q);

  return (
    <View style={styles.box}>
      <Press
        haptic={false}
        onPress={() => {
          tap();
          setOpen(!open);
        }}
        style={styles.head}
        accessibilityLabel="Спросить технолога"
      >
        <View style={styles.badge}>
          <Icon
            name="comment"
            size={17}
            color={colors.violetDeep}
            strokeWidth={2}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Спросить технолога</Text>
          <Text style={styles.sub}>
            Короткий ответ по составу этого средства
          </Text>
        </View>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Icon name="chevronDown" size={18} color={colors.muted} />
        </View>
      </Press>
      {open && (
        <>
          <View style={styles.chips}>
            {SUGGEST.filter((s) => !asked.includes(s)).map((s) => (
              <Press
                key={s}
                haptic={false}
                onPress={() => ask(s)}
                disabled={busy}
                style={styles.chip}
              >
                <Text style={styles.chipText}>{s}</Text>
              </Press>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Свой вопрос о средстве"
              placeholderTextColor={colors.faint}
              style={styles.input}
              maxLength={200}
              returnKeyType="send"
              onSubmitEditing={() => ask(q)}
            />
            <Press
              onPress={() => ask(q)}
              disabled={busy || q.trim().length < 3}
              style={[styles.send, q.trim().length < 3 && { opacity: 0.4 }]}
              accessibilityLabel="Спросить"
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon
                  name="arrowRight"
                  size={18}
                  color="#fff"
                  strokeWidth={2.2}
                />
              )}
            </Press>
          </View>

          {answers.map((x, i) => (
            <View key={`${x.q}${i}`} style={styles.qa}>
              <Text style={styles.q}>{x.q}</Text>
              <Text style={[styles.a, x.error && { color: colors.muted }]}>
                {x.a}
              </Text>
            </View>
          ))}
          {answers.length > 0 && (
            <Text style={styles.foot}>
              Ответ ИИ по составу — не заменяет консультацию дерматолога.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    gap: 12,
    shadowColor: "#5B47C9",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F1EDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 1,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 13,
    height: 36,
    borderRadius: 99,
    backgroundColor: SOFT,
    justifyContent: "center",
  },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 99,
    backgroundColor: SOFT,
    paddingHorizontal: 18,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  qa: { padding: 14, borderRadius: 18, backgroundColor: "#F7F5FF", gap: 6 },
  q: { fontFamily: fonts.semibold, fontSize: 14, color: colors.violetDeep },
  a: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink,
  },
  foot: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.faint },
});
