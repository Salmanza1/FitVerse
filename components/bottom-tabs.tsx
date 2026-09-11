import { withLayoutContext } from 'expo-router';
import {
    createNativeBottomTabNavigator,
    type NativeBottomTabNavigationOptions,
    type NativeBottomTabNavigationEventMap,
} from '@bottom-tabs/react-navigation';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';

/**
 * Expo Router adapter for the platform's own bottom tab bar.
 *
 * This renders a real UITabBar on iOS, which is what gets Apple's Liquid Glass
 * — the material, the selection morph and the scroll-edge behaviour come from
 * the system rather than from anything we draw. That is why the hand-built
 * glass bar it replaces could never quite match it.
 *
 * Requires a development build; the native view is not present in Expo Go.
 */

const BottomTabNavigator = createNativeBottomTabNavigator().Navigator;

export const Tabs = withLayoutContext<
    NativeBottomTabNavigationOptions,
    typeof BottomTabNavigator,
    TabNavigationState<ParamListBase>,
    NativeBottomTabNavigationEventMap
>(BottomTabNavigator);
