import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    LayoutChangeEvent,
    GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { VisualSystem } from '@/constants/VisualSystem';

const VERTICAL_INSET = 8;
const MIN_FONT = 6;
const MAX_FONT = 10;
const MAX_ACTIVE_FONT = 11;

type Props = {
    /** Full A–Z (26 letters) */
    letters: string[];
    /** Letters that have exercises in the list */
    enabledLetters?: ReadonlySet<string>;
    onLetterSelect: (letter: string) => void;
    activeLetter?: string | null;
    active?: boolean;
};

/**
 * Minimal A–Z scrub rail — letters scale to always fit the available height.
 */
export function AlphabetIndexBar({
    letters,
    enabledLetters,
    onLetterSelect,
    activeLetter,
    active = true,
}: Props) {
    const [dragLetter, setDragLetter] = useState<string | null>(null);
    const [layoutHeight, setLayoutHeight] = useState(0);
    const barTop = useRef(0);
    const lastLetter = useRef<string | null>(null);
    const lettersRef = useRef(letters);
    const onSelectRef = useRef(onLetterSelect);
    const wrapRef = useRef<View>(null);

    const metrics = useMemo(() => {
        const count = Math.max(letters.length, 1);
        const usable = Math.max(layoutHeight - VERTICAL_INSET * 2, 1);
        const slotHeight = usable / count;
        const fontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, slotHeight * 0.68));
        const activeFontSize = Math.min(MAX_ACTIVE_FONT, fontSize + 1);
        return { count, usable, slotHeight, fontSize, activeFontSize };
    }, [letters.length, layoutHeight]);

    useEffect(() => {
        lettersRef.current = letters;
        onSelectRef.current = onLetterSelect;
    });

    const measureBar = useCallback(() => {
        wrapRef.current?.measureInWindow((_x, y, _w, h) => {
            if (h > 0) barTop.current = y;
        });
    }, []);

    useEffect(() => {
        if (!active) return;
        const t = setTimeout(measureBar, 80);
        return () => clearTimeout(t);
    }, [active, letters.length, layoutHeight, measureBar]);

    const pickAtPageY = (pageY: number) => {
        const list = lettersRef.current;
        const { usable, count } = metrics;
        if (list.length === 0 || usable <= 0) return;

        const y = pageY - barTop.current - VERTICAL_INSET;
        const ratio = Math.max(0, Math.min(1, y / usable));
        const index = Math.min(list.length - 1, Math.floor(ratio * count));
        const letter = list[index];
        if (!letter) return;

        if (lastLetter.current !== letter) {
            lastLetter.current = letter;
            setDragLetter(letter);
            onSelectRef.current(letter);
            Haptics.selectionAsync();
        }
    };

    const onTouch = (e: GestureResponderEvent) => {
        pickAtPageY(e.nativeEvent.pageY);
    };

    const endDrag = () => {
        setDragLetter(null);
        lastLetter.current = null;
    };

    const onLayout = (e: LayoutChangeEvent) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) setLayoutHeight(h);
        measureBar();
    };

    const highlighted = dragLetter ?? activeLetter ?? null;

    return (
        <View ref={wrapRef} style={styles.wrap} onLayout={onLayout}>
            {dragLetter ? (
                <View style={styles.tooltip} pointerEvents="none">
                    <Text style={styles.tooltipText}>{dragLetter}</Text>
                </View>
            ) : null}
            <View
                style={styles.touchStrip}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={onTouch}
                onResponderMove={onTouch}
                onResponderRelease={endDrag}
                onResponderTerminate={endDrag}
                accessibilityLabel="Alphabet index. Slide to jump to a letter."
            >
                <View
                    pointerEvents="none"
                    style={[styles.lettersColumn, { paddingVertical: VERTICAL_INSET }]}
                >
                    {letters.map((letter) => {
                        const isActive = highlighted === letter;
                        const isEnabled = !enabledLetters || enabledLetters.has(letter);
                        return (
                            <View
                                key={letter}
                                style={[styles.letterCell, { height: metrics.slotHeight }]}
                            >
                                <Text
                                    style={[
                                        styles.letter,
                                        {
                                            fontSize: isActive
                                                ? metrics.activeFontSize
                                                : metrics.fontSize,
                                        },
                                        !isEnabled && styles.letterDisabled,
                                        isActive && isEnabled && styles.letterActive,
                                        isActive && !isEnabled && styles.letterActiveDisabled,
                                    ]}
                                    allowFontScaling={false}
                                >
                                    {letter}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        width: 28,
        alignSelf: 'stretch',
        paddingRight: 4,
        zIndex: 10,
    },
    touchStrip: {
        flex: 1,
        width: '100%',
    },
    lettersColumn: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    letterCell: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    letter: {
        fontWeight: '500',
        color: VisualSystem.colors.textTertiary,
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    letterDisabled: {
        opacity: 0.28,
    },
    letterActive: {
        color: VisualSystem.colors.gold,
        fontWeight: '700',
    },
    letterActiveDisabled: {
        color: VisualSystem.colors.textSecondary,
        fontWeight: '600',
        opacity: 0.5,
    },
    tooltip: {
        position: 'absolute',
        left: -52,
        top: '42%',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(19, 45, 82, 0.92)',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderGold,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        ...VisualSystem.shadow.card,
    },
    tooltipText: {
        color: VisualSystem.colors.gold,
        fontSize: 18,
        fontWeight: '700',
    },
});
