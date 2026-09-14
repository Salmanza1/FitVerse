import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    View,
    type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VisualSystem } from '@/constants/VisualSystem';

const C = VisualSystem.colors;

/**
 * A bottom sheet that comes up the way iOS sheets do: the scrim fades in
 * where it is while the panel slides up under it.
 *
 * React Native's own `animationType="slide"` translates the whole modal
 * root, and on a transparent modal the scrim is part of that root — so the
 * grey slides up too and its top edge reads as a line sweeping up the
 * screen. Driving the two separately is the only way to avoid it, so the
 * Modal is mounted with no animation of its own and both halves are
 * animated here.
 */

const IN_MS = 260;
const OUT_MS = 200;

type Props = {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    /** Tapping the scrim closes the sheet. Off for destructive flows. */
    dismissOnBackdrop?: boolean;
    /** Lifts the sheet above the keyboard. */
    avoidKeyboard?: boolean;
    /** Tallest the panel may grow before its content scrolls. */
    maxHeight?: ViewStyle['maxHeight'];
    /** Extra styling on the panel itself. */
    contentStyle?: ViewStyle;
};

export function SheetModal({
    visible,
    onClose,
    children,
    dismissOnBackdrop = true,
    avoidKeyboard = true,
    maxHeight = '92%',
    contentStyle,
}: Props) {
    const insets = useSafeAreaInsets();
    // Kept mounted through the close animation so it plays out.
    const [mounted, setMounted] = useState(visible);
    const [sheetHeight, setSheetHeight] = useState(0);
    const progress = useRef(new Animated.Value(0)).current;
    // The slide distance is the panel's own height, which is only known
    // after layout; until then the panel is held invisible rather than
    // flashed at rest with no scrim behind it.
    const hasEnteredRef = useRef(false);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            return;
        }
        if (!mounted) return;
        Animated.timing(progress, {
            toValue: 0,
            duration: OUT_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (!finished) return;
            hasEnteredRef.current = false;
            setSheetHeight(0);
            setMounted(false);
        });
    }, [visible, mounted, progress]);

    useEffect(() => {
        // Enter once, after the first layout. Later height changes (an image
        // added to the post, the keyboard opening) must not replay it.
        if (!mounted || !visible || sheetHeight <= 0 || hasEnteredRef.current) return;
        hasEnteredRef.current = true;
        Animated.timing(progress, {
            toValue: 1,
            duration: IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [mounted, visible, sheetHeight, progress]);

    if (!mounted) return null;

    const translateY = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sheetHeight || 0, 0],
    });

    const panel = (
        <Animated.View
            onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0 && h !== sheetHeight) setSheetHeight(h);
            }}
            style={[
                styles.sheet,
                { paddingBottom: Math.max(insets.bottom, 20), maxHeight },
                contentStyle,
                // Hidden only for the frame between mount and first layout.
                { opacity: sheetHeight > 0 ? 1 : 0, transform: [{ translateY }] },
            ]}
        >
            {children}
        </Animated.View>
    );

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.root}>
                <Animated.View style={[styles.scrim, { opacity: progress }]}>
                    <Pressable
                        style={styles.scrimPress}
                        onPress={dismissOnBackdrop ? onClose : undefined}
                        accessibilityLabel={dismissOnBackdrop ? 'Close' : undefined}
                    />
                </Animated.View>

                {avoidKeyboard ? (
                    <KeyboardAvoidingView
                        style={styles.panelSlot}
                        pointerEvents="box-none"
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        {panel}
                    </KeyboardAvoidingView>
                ) : (
                    panel
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    scrim: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: C.overlay,
    },
    scrimPress: {
        flex: 1,
    },
    panelSlot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: C.bgMid,
        borderTopLeftRadius: VisualSystem.radius.xl,
        borderTopRightRadius: VisualSystem.radius.xl,
        paddingHorizontal: VisualSystem.spacing.lg,
        paddingTop: VisualSystem.spacing.lg,
        // Top edge only. A full border draws a stray hairline along the
        // bottom of the screen, under the panel.
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: C.borderSubtle,
        ...VisualSystem.shadow.raised,
    },
});
