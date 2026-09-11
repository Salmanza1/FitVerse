import React from 'react';
import { StyleSheet, View, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Text } from '@/components/Themed';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import * as Haptics from 'expo-haptics';
import { VisualSystem } from '@/constants/VisualSystem';

interface SegmentedControlProps {
    options: string[];
    value: string;
    onSelect: (value: string) => void;
    containerStyle?: any;
}

export function SegmentedControl({ options, value, onSelect, containerStyle }: SegmentedControlProps) {
    const selectedIndex = options.indexOf(value);
    const scrollX = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.spring(scrollX, {
            toValue: selectedIndex,
            useNativeDriver: true,
            tension: 60,
            friction: 10
        }).start();
    }, [selectedIndex]);

    const itemWidth = 100 / options.length;

    return (
        <View style={[styles.container, containerStyle]}>
            <Animated.View 
                style={[
                    styles.activeTab, 
                    { 
                        width: `${itemWidth}%`, 
                        transform: [{
                            translateX: scrollX.interpolate({
                                inputRange: options.map((_, i) => i),
                                outputRange: options.map((_, i) => (Dimensions.get('window').width - 40) / options.length * i) // Simplified, though container might vary
                            })
                        }] 
                    }
                ]} 
            />
            {options.map((opt, i) => (
                <TouchableOpacity 
                    key={opt}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onSelect(opt);
                    }}
                    style={styles.tab}
                >
                    <Text style={[
                        styles.tabText, 
                        value === opt && styles.tabTextActive
                    ]}>
                        {opt.toUpperCase()}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

// Improved version for dynamic widths
export function SmartSegmentedControl({ options, value, onSelect, containerStyle }: SegmentedControlProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            <View style={styles.pillRow}>
                {options.map((opt) => (
                    <TouchableOpacity 
                        key={opt}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onSelect(opt);
                        }}
                        style={[
                            styles.pill, 
                            value === opt && styles.pillActive
                        ]}
                    >
                        <Text style={[
                            styles.pillText, 
                            value === opt && styles.pillTextActive
                        ]}>
                            {opt.toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
        padding: 4,
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    activeTab: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 4,
        backgroundColor: FitVerseTheme.colors.ndGold,
        borderRadius: 10,
        // Elevation/Shadow
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
    },
    tab: {
        flex: 1,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabText: {
        fontSize: 11,
        fontWeight: '800',
        color: VisualSystem.colors.textTertiary,
        letterSpacing: 0.2,
    },
    tabTextActive: {
        color: '#000',
    },
    // Pill variant
    pillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: 4,
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    pillActive: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderColor: FitVerseTheme.colors.ndGold,
    },
    pillText: {
        fontSize: 11,
        fontWeight: '800',
        color: VisualSystem.colors.textSecondary,
        letterSpacing: 0.5,
    },
    pillTextActive: {
        color: VisualSystem.colors.goldText,
    }
});
