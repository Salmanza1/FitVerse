/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
    type: 'widget',
    name: 'RestTimerActivity',
    displayName: 'FitVerse Rest Timer',
    // Live Activities are 16.2+; the plugin otherwise defaults to 18.0, which
    // would drop the widget on anything older than iOS 18.
    deploymentTarget: '16.2',
    frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
});
