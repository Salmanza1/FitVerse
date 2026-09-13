import ActivityKit
import WidgetKit
import SwiftUI

/// Rest-timer Live Activity.
///
/// The shape below MUST stay identical to the copy in
/// modules/rest-activity/ios/RestActivityModule.swift. The two targets compile
/// separately and ActivityKit matches them by structure, so a field added to
/// one and not the other fails at runtime, not at build time.
struct RestTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Start and end of the rest, as wall-clock instants.
        ///
        /// The countdown is handed to the system as a range rather than as a
        /// number of seconds we keep pushing: SwiftUI's timer text ticks on its
        /// own, so the display stays right while the app is suspended, which is
        /// the whole point of showing it here.
        var startedAt: Date
        var endsAt: Date
        var exerciseName: String
    }

    /// Fixed for the life of the activity.
    var workoutName: String
}

private let goldVivid = Color(red: 0.89, green: 0.63, blue: 0.03)
private let navy = Color(red: 0.05, green: 0.14, blue: 0.25)

struct RestTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerAttributes.self) { context in
            // Lock screen and banner.
            HStack(spacing: 14) {
                Image(systemName: "timer")
                    .font(.title2)
                    .foregroundColor(goldVivid)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Resting")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(context.state.exerciseName)
                        .font(.headline)
                        .lineLimit(1)
                }

                Spacer()

                Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                    .font(.system(.title, design: .rounded).monospacedDigit())
                    .foregroundColor(goldVivid)
                    .frame(maxWidth: 90, alignment: .trailing)
            }
            .padding()
            .activityBackgroundTint(navy.opacity(0.92))
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "timer")
                        .font(.title2)
                        .foregroundColor(goldVivid)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                        .font(.system(.title2, design: .rounded).monospacedDigit())
                        .foregroundColor(goldVivid)
                        .frame(maxWidth: 80)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.exerciseName)
                            .font(.headline)
                            .lineLimit(1)
                        Text(context.attributes.workoutName)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundColor(goldVivid)
            } compactTrailing: {
                Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                    .monospacedDigit()
                    .foregroundColor(goldVivid)
                    .frame(maxWidth: 44)
            } minimal: {
                Image(systemName: "timer")
                    .foregroundColor(goldVivid)
            }
            .keylineTint(goldVivid)
        }
    }
}
