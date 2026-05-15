import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQueryClient } from "@tanstack/react-query";

import { Feather } from "@expo/vector-icons";

import { Body, Heading } from "@/components/Heading";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useColors } from "@/hooks/useColors";
import {
  useGetMe,
  useListTribeMessages,
  useSendTribeMessage,
  getListTribeMessagesQueryKey,
  type ChatMessage,
} from "@workspace/api-client-react";

export default function ChatTab() {
  const colors = useColors();
  const qc = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const { data: me, isLoading: meLoading } = useGetMe();
  const [draft, setDraft] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const s2 = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const queryKey = getListTribeMessagesQueryKey();
  const { data: messages, isLoading: msgsLoading } = useListTribeMessages(undefined, {
    query: {
      queryKey,
      enabled: !!me?.tribeId,
      refetchInterval: 4000,
      refetchIntervalInBackground: false,
    },
  });

  const sendMutation = useSendTribeMessage({
    mutation: {
      onSuccess: () => {
        setDraft("");
        qc.invalidateQueries({ queryKey });
      },
    },
  });

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages?.length]);

  if (meLoading) return <LoadingScreen />;

  const onSend = () => {
    const body = draft.trim();
    if (!body || sendMutation.isPending || !me?.tribeId) return;
    sendMutation.mutate({ data: { body } });
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
          <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
            {me?.tribeName ? `${me.tribeName.toUpperCase()} · ${me.tribeCode}` : "TRIBE CHAT"}
          </Body>
          <Heading style={{ marginTop: 4 }}>Chat</Heading>
        </View>

        {!me?.tribeId ? (
          <View style={{ padding: 20 }}>
            <Body muted>You need to join a tribe first.</Body>
          </View>
        ) : msgsLoading && !messages ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Body muted>Loading messages…</Body>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages ?? []}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: "center" }}>
                <Body muted style={{ textAlign: "center" }}>
                  No messages yet. Say hello to your tribe!
                </Body>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.userId === me?.id;
              return (
                <View
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                    backgroundColor: mine ? colors.primary : colors.card,
                    borderColor: mine ? colors.primary : colors.border,
                    borderWidth: 1,
                    borderRadius: 18,
                    borderBottomRightRadius: mine ? 4 : 18,
                    borderBottomLeftRadius: mine ? 18 : 4,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  {!mine && (
                    <Body
                      style={{
                        fontFamily: "WorkSans_600SemiBold",
                        fontSize: 11,
                        color: colors.mutedForeground,
                        marginBottom: 2,
                      }}
                    >
                      {item.displayName ?? item.username}
                    </Body>
                  )}
                  <Body
                    style={{
                      color: mine ? colors.primaryForeground : colors.foreground,
                      fontSize: 14,
                    }}
                  >
                    {item.body}
                  </Body>
                  <Body
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      color: mine
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                      opacity: mine ? 0.75 : 1,
                      textAlign: "right",
                    }}
                  >
                    {formatTime(item.createdAt)}
                  </Body>
                </View>
              );
            }}
          />
        )}

        {me?.tribeId && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 8,
              padding: 12,
              paddingBottom: keyboardVisible ? 12 : 12 + tabBarHeight,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            {keyboardVisible && (
              <Pressable
                onPress={() => Keyboard.dismiss()}
                hitSlop={8}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="chevron-down" size={20} color={colors.foreground} />
              </Pressable>
            )}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message your tribe..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={1000}
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 120,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: colors.foreground,
                fontFamily: "WorkSans_400Regular",
                fontSize: 14,
              }}
            />
            <Pressable
              onPress={onSend}
              disabled={!draft.trim() || sendMutation.isPending}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: !draft.trim() || sendMutation.isPending ? colors.muted : colors.primary,
              }}
            >
              <Body
                style={{
                  color: colors.primaryForeground,
                  fontFamily: "WorkSans_600SemiBold",
                }}
              >
                {sendMutation.isPending ? "..." : "Send"}
              </Body>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
