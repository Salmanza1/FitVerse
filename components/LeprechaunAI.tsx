import React, { useRef, useState, useEffect } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    Animated,
    PanResponder,
    Modal,
    FlatList,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator
} from 'react-native';
import { View, Text, Card, SecondaryText } from './Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getLeprechaunResponse, getLeprechaunResponseWithTools, Message } from '@/lib/openai';
import { useAuth } from '@/features/auth/AuthContext';
import { VisualSystem } from '@/constants/VisualSystem';

export function LeprechaunAI({ renderTrigger }: { renderTrigger?: (open: () => void) => React.ReactNode }) {
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const [isChatOpen, setIsChatOpen] = useState(false);

    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "☘️ Top o' the morning to ya! I'm the Leprechaun AI. Ready to crush some elite goals today?" }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingAction, setPendingAction] = useState<any | null>(null);
    const { user, updateProfile } = useAuth();
    const flatListRef = useRef<FlatList>(null);


    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
            },
            onPanResponderGrant: () => {
                pan.setOffset({
                    x: (pan.x as any)._value,
                    y: (pan.y as any)._value
                });
            },
            onPanResponderMove: Animated.event(
                [null, { dx: pan.x, dy: pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: () => {
                pan.flattenOffset();
            },
        })
    ).current;

    const handleSendMessage = async () => {
        if (!inputText.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: inputText.trim() };
        const newMessages = [...messages, userMsg];

        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        const aiResponse = await getLeprechaunResponseWithTools(newMessages, user);

        if (aiResponse.type === 'action') {
            setPendingAction(aiResponse);
        } else if (aiResponse.type === 'text' && aiResponse.content) {
            setMessages([...newMessages, { role: 'assistant', content: aiResponse.content }]);
        }

        setIsLoading(false);
    };

    const handleConfirmAction = async (confirm: boolean) => {
        if (!pendingAction) return;
        setIsLoading(true);

        let assistantMessage = "";

        if (confirm) {
            const { functionName, args } = pendingAction;

            try {
                let updates: any = {};
                if (functionName === 'update_fitness_goal' && args.goal) updates.goal = args.goal;
                else if (functionName === 'update_weight' && args.weightKg) updates.weightKg = args.weightKg;
                else if (functionName === 'update_gym' && args.gym) updates.defaultGym = args.gym;
                else if (functionName === 'update_display_name' && args.name) updates.displayName = args.name;

                if (Object.keys(updates).length > 0) {
                    await updateProfile(updates);
                    assistantMessage = `☘️ Done! I've updated your profile. Keep working hard!`;
                } else {
                    assistantMessage = `☘️ Mmh, I wasn't able to figure out how to update that. My apologies!`;
                }
            } catch (error) {
                console.error("Failed to update profile", error);
                assistantMessage = `☘️ Ach! Magic failed. I couldn't update your profile right now.`;
            }
        } else {
            assistantMessage = `☘️ No worries, lad! We'll leave it as is.`;
        }

        setMessages([...messages, { role: 'assistant', content: assistantMessage }]);
        setPendingAction(null);
        setIsLoading(false);
    };

    useEffect(() => {
        if (isChatOpen) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, isChatOpen]);

    const renderFloating = () => (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { translateX: pan.x },
                        { translateY: pan.y }
                    ]
                }
            ]}
            {...panResponder.panHandlers}
        >
            <TouchableOpacity
                style={styles.button}
                onPress={() => setIsChatOpen(true)}
                activeOpacity={0.8}
            >
                <FontAwesome name="leaf" size={24} color="#C99700" />
            </TouchableOpacity>
        </Animated.View>
    );

    return (
        <>
            {renderTrigger ? renderTrigger(() => setIsChatOpen(true)) : renderFloating()}

            <Modal
                visible={isChatOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsChatOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <Card style={styles.chatContainer}>
                        {/* Header */}
                        <View style={styles.chatHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.miniLeaf}>
                                    <FontAwesome name="leaf" size={14} color="#C99700" />
                                </View>
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={styles.chatTitle}>Leprechaun AI</Text>
                                    <SecondaryText style={{ fontSize: 11 }}>ELITE MENTOR</SecondaryText>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setIsChatOpen(false)} style={styles.closeBtn}>
                                <FontAwesome name="times" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* Message List */}
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            keyExtractor={(_, index) => index.toString()}
                            contentContainerStyle={styles.messageList}
                            renderItem={({ item }) => (
                                <View style={[
                                    styles.messageBubble,
                                    item.role === 'user' ? styles.userBubble : styles.assistantBubble
                                ]}>
                                    <Text style={[
                                        styles.messageText,
                                        item.role === 'user' ? styles.userText : styles.assistantText
                                    ]}>
                                        {item.content}
                                    </Text>
                                </View>
                            )}
                            ListFooterComponent={pendingAction ? (
                                <View style={styles.actionCard}>
                                    <View style={styles.actionCardHeader}>
                                        <FontAwesome name="magic" size={14} color="#C99700" />
                                        <Text style={styles.actionCardTitle}>PROPOSED ACTION</Text>
                                    </View>
                                    <Text style={styles.actionCardDesc}>
                                        Update {pendingAction.functionName.replace('update_', '').replace(/_/g, ' ')}:
                                    </Text>
                                    <View style={styles.actionParamsBox}>
                                        {Object.entries(pendingAction.args).map(([k, v]) => (
                                            <Text key={k} style={styles.actionParamText}>• {k}: {String(v)}</Text>
                                        ))}
                                    </View>
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.actionBtnCancel]}
                                            onPress={() => handleConfirmAction(false)}
                                            disabled={isLoading}
                                        >
                                            <Text style={styles.actionBtnTextCancel}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.actionBtnConfirm]}
                                            onPress={() => handleConfirmAction(true)}
                                            disabled={isLoading}
                                        >
                                            <Text style={styles.actionBtnTextConfirm}>Confirm</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                        />

                        {/* Input Area */}
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                        >
                            <View style={styles.inputArea}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ask for advice, lad..."
                                    placeholderTextColor="#666"
                                    value={inputText}
                                    onChangeText={setInputText}
                                    multiline
                                />
                                <TouchableOpacity
                                    style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
                                    onPress={handleSendMessage}
                                    disabled={!inputText.trim() || isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator size="small" color="black" />
                                    ) : (
                                        <FontAwesome name="paper-plane" size={18} color="black" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </Card>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 100,
        right: 25,
        zIndex: 9999,
        shadowColor: VisualSystem.colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 10,
    },
    button: {
        width: 64,
        height: 64,
        borderRadius: 28,
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: VisualSystem.colors.borderGold,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: VisualSystem.colors.overlay,
        justifyContent: 'flex-end',
    },
    chatContainer: {
        height: '80%',
        margin: 8,
        padding: 0,
        overflow: 'hidden',
        backgroundColor: VisualSystem.colors.bgBase,
        borderWidth: 1,
        borderColor: '#161616',
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#161616',
        backgroundColor: VisualSystem.colors.bgMid,
    },
    chatTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
    },
    miniLeaf: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgBase,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderGold,
    },
    closeBtn: {
        padding: 4,
    },
    messageList: {
        padding: 16,
        paddingBottom: 32,
    },
    messageBubble: {
        maxWidth: '85%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 16,
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: VisualSystem.colors.bgBase,
        borderBottomLeftRadius: 4,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: VisualSystem.colors.gold,
        borderBottomRightRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    assistantText: {
        color: VisualSystem.colors.textPrimary,
    },
    userText: {
        color: '#000',
        fontWeight: '600',
    },
    inputArea: {
        flexDirection: 'row',
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
        backgroundColor: VisualSystem.colors.bgBase,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgBase,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 8,
        color: VisualSystem.colors.textPrimary,
        maxHeight: 100,
        fontSize: 15,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.gold,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    sendBtnDisabled: {
        opacity: 0.5,
    },
    actionCard: {
        backgroundColor: VisualSystem.colors.bgBase,
        borderRadius: 10,
        padding: 16,
        marginTop: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderGold,
        alignSelf: 'stretch',
    },
    actionCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionCardTitle: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        marginLeft: 8,
    },
    actionCardDesc: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 13,
        marginBottom: 8,
    },
    actionParamsBox: {
        backgroundColor: VisualSystem.colors.bgBase,
        padding: 8,
        borderRadius: 6,
        marginBottom: 16,
    },
    actionParamText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 13,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnCancel: {
        backgroundColor: VisualSystem.colors.bgBase,
    },
    actionBtnConfirm: {
        backgroundColor: VisualSystem.colors.gold,
    },
    actionBtnTextCancel: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
        fontSize: 13,
    },
    actionBtnTextConfirm: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
        fontSize: 13,
    }
});
